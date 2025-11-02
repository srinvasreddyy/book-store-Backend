import { Book } from "../models/book.model.js";
import { Tag } from "../models/tag.model.js";
import { Category } from "../models/category.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiError } from "../../utils/ApiError.js";
import mongoose from "mongoose";
import cache from "../../utils/cache.js";

/**
 * Clears all book-related list and detail caches.
 * @param {string} [bookId] - If provided, also clears the cache for a specific book.
 */
const clearBookCaches = (bookId) => {
    cache.delByPrefix("allBooks_");
    cache.delByPrefix("newReleases_");
    if (bookId) {
        cache.del(`book_${bookId}`);
    }
};

const createBook = async (bookData, user, files) => {
    const {
        title, author, isbn, publisher, numberOfPages, category, format,
        language, shortDescription, fullDescription, tags, price, stock,
    } = bookData;

    const isFeatured = bookData.isFeatured === 'true' || bookData.isFeatured === true;
    const isBestSeller = bookData.isBestSeller === 'true' || bookData.isBestSeller === true;


    // --- Comprehensive Input Validation ---
    const requiredFields = { title, author, publisher, category, format, language, shortDescription, fullDescription };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === "") {
            const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
            throw new ApiError(400, `${fieldName} is required.`);
        }
    }
    
    const allowedFormats = ['Hardcover', 'Paperback'];
    if (!allowedFormats.includes(format)) {
        throw new ApiError(400, `Invalid format. Must be one of: ${allowedFormats.join(', ')}`);
    }

    const numericFields = { numberOfPages, price, stock };
    for (const [field, value] of Object.entries(numericFields)) {
        const parsedValue = Number(value);
        if (value === undefined || isNaN(parsedValue)) {
            throw new ApiError(400, `${field} must be a valid number.`);
        }
        if (parsedValue < 0) {
            throw new ApiError(400, `${field} cannot be negative.`);
        }
    }
    
    const coverImageFiles = files?.coverImages;
    if (!coverImageFiles || coverImageFiles.length === 0) {
        throw new ApiError(400, "At least one cover image is required.");
    }
    if (coverImageFiles.length > 5) {
        throw new ApiError(400, "You can upload a maximum of 5 cover images.");
    }
    console.log('Cover image files:', coverImageFiles.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, size: f.size, buffer: !!f.buffer, isBuffer: Buffer.isBuffer(f.buffer) })));
    // --- End Validation ---

    // --- FEATURE-020: Hardened Category Validation ---
    // The 'category' field must now be a valid ObjectId.
    if (!mongoose.isValidObjectId(category)) {
        throw new ApiError(400, "A valid category ID is required. Creating categories by name is no longer supported.");
    }
    
    // Check if the category exists and if the admin is allowed to use it (either global or their own)
    const categoryDoc = await Category.findOne({
      _id: category,
      $or: [{ owner: null }, { owner: user._id }]
    });

    if (!categoryDoc) {
      throw new ApiError(404, "The selected category does not exist or you do not have permission to use it.");
    }
    // --- End FEATURE-020 ---

    // Check for duplicate ISBN only if ISBN is provided
    if (isbn && isbn.trim() !== "") {
        const existingBook = await Book.findOne({ isbn });
        if (existingBook) {
            throw new ApiError(409, "A book with this ISBN already exists.");
        }
    }

    // --- Normalize tag inputs ---
    // The admin UI may send tags in several shapes: as 'tags' (could be names or ids),
    // 'tagNames' (one or many fields with names), or 'tagIds' (one or many ids).
    // Collect all provided IDs and names, create any new tags for names and produce final tagIds array.
    let providedTagIds = [];
    let providedTagNames = [];

    // Helper to ensure value is array
    const toArray = (v) => (Array.isArray(v) ? v : v !== undefined && v !== null ? [v] : []);

    // If the client provided explicit tagIds
    if (bookData.tagIds) {
        providedTagIds = toArray(bookData.tagIds).map(String).filter(Boolean);
    }

    // If the client provided tagNames explicitly (one or many fields named 'tagNames')
    if (bookData.tagNames) {
        providedTagNames = toArray(bookData.tagNames).map(t => String(t).trim().toLowerCase()).filter(Boolean);
    }

    // The legacy/primary 'tags' field may contain either ids or names depending on the client.
    if (tags) {
        const tagList = toArray(tags).map(t => String(t).trim()).filter(Boolean);
        tagList.forEach((t) => {
            if (mongoose.isValidObjectId(t)) {
                providedTagIds.push(t);
            } else {
                providedTagNames.push(t.toLowerCase());
            }
        });
    }

    // De-duplicate
    providedTagIds = Array.from(new Set(providedTagIds));
    providedTagNames = Array.from(new Set(providedTagNames));

    // Create or lookup tags for provided names and get their ids
    let generatedTagIds = [];
    if (providedTagNames.length > 0) {
        const tagOperations = providedTagNames.map(async (tagName) => {
            const tag = await Tag.findOneAndUpdate(
                { name: tagName },
                { $setOnInsert: { name: tagName } },
                { upsert: true, new: true }
            );
            return tag._id;
        });
        generatedTagIds = (await Promise.all(tagOperations)).filter(Boolean).map(id => id.toString());
    }

    // Final tag ids array used for the book
    let tagIds = [...providedTagIds, ...generatedTagIds];
    tagIds = Array.from(new Set(tagIds));

    // --- Upload cover images ---
    const imageUploadPromises = coverImageFiles.map(file => uploadOnCloudinary(file.buffer));
    const uploadResults = await Promise.all(imageUploadPromises);
    const imageUrls = uploadResults.map(result => {
        if (!result || !result.url) {
            throw new ApiError(500, "Failed to upload one or more cover images. Please try again.");
        }
        return result.url;
    });

    // --- Handle optional PDF upload ---
    let samplePdfUrl = null;
    const samplePdfFile = files?.samplePdf?.[0];
    if (samplePdfFile) {
        const pdfUploadResult = await uploadOnCloudinary(samplePdfFile.buffer);
        if (!pdfUploadResult || !pdfUploadResult.url) {
            throw new ApiError(500, "Failed to upload the sample PDF. Please try again.");
        }
        samplePdfUrl = pdfUploadResult.url;
    }

    const book = await Book.create({
        title,
        author,
        isbn,
        publisher,
        numberOfPages,
        category: categoryDoc._id,
        format,
        language,
        shortDescription,
        fullDescription,
        tags: tagIds,
        price,
        stock,
        coverImages: imageUrls,
        samplePdfUrl,
        uploadedBy: user._id,
        isFeatured, // Use the converted boolean value
        isBestSeller, // Use the converted boolean value
    });

    const createdBook = await Book.findById(book._id).populate("tags").populate("category");
    if (!createdBook) {
        throw new ApiError(500, "Something went wrong while creating the book.");
    }

    clearBookCaches();
    return createdBook;
};

const getAllBooks = async (queryParams) => {
    const cacheKey = `allBooks_${JSON.stringify(queryParams)}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const { page = 1, limit = 10, category, search, sortBy, sortOrder = 'asc', tags, isBestSeller } = queryParams;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [{ path: "tags" }, { path: "category", select: "name" }]
    };

    let pipeline = [];
    const matchStage = {};

    if (search) {
        matchStage.$or = [
            { title: { $regex: search, $options: 'i' } },
            { author: { $regex: search, $options: 'i' } }
        ];
    }

    if (category) {
        if (mongoose.isValidObjectId(category)) {
            // --- FEATURE-020: Search by parent category ---
            // Find the category and all its descendants
            const categoryDoc = await Category.findById(category).lean();
            if (categoryDoc) {
                const categoriesToSearch = [categoryDoc._id];
                
                // Find all immediate children of the specified category
                const childCategories = await Category.find({ parentCategory: categoryDoc._id }).select('_id').lean();
                categoriesToSearch.push(...childCategories.map(c => c._id));
                
                matchStage.category = { $in: categoriesToSearch };
            } else {
               // Category ID is valid but not found
               return { docs: [], totalDocs: 0, limit, page, totalPages: 1, nextPage: null, prevPage: null };
            }
            // --- End FEATURE-020 ---
        } else {
            // Invalid Category ID format
            return { docs: [], totalDocs: 0, limit, page, totalPages: 1, nextPage: null, prevPage: null };
        }
    }
    
    // Support filtering books that are marked as best sellers
    if (typeof isBestSeller !== 'undefined') {
        // Accept 'true'/'false' strings or boolean values
        matchStage.isBestSeller = (isBestSeller === 'true' || isBestSeller === true);
    }
    
    if (Object.keys(matchStage).length > 0) {
        pipeline.push({ $match: matchStage });
    }

    if (tags) {
        const tagNames = tags.split(',').map(t => t.trim().toLowerCase());
        const foundTags = await Tag.find({ name: { $in: tagNames } }).select('_id');
        const tagIds = foundTags.map(t => t._id);
        if (tagIds.length > 0) {
             pipeline.push({ $match: { tags: { $in: tagIds } } });
        }
    }

    if (sortBy) {
        const order = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: { [sortBy]: order } });
    }

    const aggregate = Book.aggregate(pipeline);
    const books = await Book.aggregatePaginate(aggregate, options);

    cache.set(cacheKey, books);
    return books;
};

const getAdminBooks = async (queryParams, user) => {
    const { page = 1, limit = 10, sortBy, sortOrder = 'asc' } = queryParams;
    const adminId = user._id;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [{ path: "tags" }, { path: "category", select: "name" }],
        sort: {}
    };

    if (sortBy) {
        options.sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    } else {
        options.sort.createdAt = -1;
    }

    const aggregate = Book.aggregate([
        { $match: { uploadedBy: new mongoose.Types.ObjectId(adminId) } }
    ]);

    const books = await Book.aggregatePaginate(aggregate, options);
    return books;
};

const getBookById = async (bookId) => {
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID format.");
    }
    const cacheKey = `book_${bookId}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    
    // --- FEATURE-020: Populate category and its parent ---
    const book = await Book.findById(bookId)
      .populate("tags")
      .populate({
          path: "category",
          select: "name parentCategory",
          populate: {
              path: "parentCategory",
              select: "name"
          }
      });
      
    if (!book) {
        throw new ApiError(404, "Book not found.");
    }
    cache.set(cacheKey, book);
    return book;
};

// --- FEATURE-022: Get New Releases ---
const getNewReleases = async (queryParams) => {
    const { page = 1, limit = 10 } = queryParams;
    const cacheKey = `newReleases_${page}_${limit}`;

    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [{ path: "tags" }, { path: "category", select: "name" }],
        sort: { createdAt: -1 } // Sort by newest first
    };

    // Calculate the date 10 days ago
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const aggregate = Book.aggregate([
        {
            $match: {
                createdAt: { $gte: tenDaysAgo }
            }
        }
    ]);

    const books = await Book.aggregatePaginate(aggregate, options);

    cache.set(cacheKey, books);
    return books;
};
// --- End FEATURE-022 ---

const updateBookDetails = async (bookId, bookData, user, files) => {
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID format.");
    }

    if (Object.keys(bookData).length === 0 && (!files || Object.keys(files).length === 0)) {
        throw new ApiError(400, "No fields provided to update.");
    }
    
    // Prevent critical fields from being updated
    delete bookData.uploadedBy;
    delete bookData.isbn; 

    const bookToUpdate = await Book.findById(bookId);
    if (!bookToUpdate) {
        throw new ApiError(404, "Book not found.");
    }

    if (bookToUpdate.uploadedBy.toString() !== user._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this book.");
    }
    
    // --- FEATURE-020: Hardened Category Validation on Update ---
    if (bookData.category) {
      if (!mongoose.isValidObjectId(bookData.category)) {
          throw new ApiError(400, "A valid category ID is required.");
      }
      
      const categoryDoc = await Category.findOne({
        _id: bookData.category,
        $or: [{ owner: null }, { owner: user._id }]
      });
  
      if (!categoryDoc) {
        throw new ApiError(404, "The selected category does not exist or you do not have permission to use it.");
      }
      // If valid, the bookData.category field is already set and will be saved
    }
    // --- End FEATURE-020 ---
    
    // Handle new cover images if provided
    if (files && files.coverImages && files.coverImages.length > 0) {
        const coverImageFiles = files.coverImages;
        if (coverImageFiles.length > 5) {
            throw new ApiError(400, "You can upload a maximum of 5 cover images.");
        }

        // Upload new images
        const imageUploadPromises = coverImageFiles.map(file => uploadOnCloudinary(file.buffer));
        const uploadResults = await Promise.all(imageUploadPromises);
        const newImageUrls = uploadResults.map(result => {
            if (!result || !result.url) {
                throw new ApiError(500, "Failed to upload one or more cover images. Please try again.");
            }
            return result.url;
        });

        // Add new images to existing ones
        bookData.coverImages = [...(bookToUpdate.coverImages || []), ...newImageUrls];
    }
    
    // --- Normalize tag inputs on update (accept tags, tagNames, tagIds) ---
    const toArray = (v) => (Array.isArray(v) ? v : v !== undefined && v !== null ? [v] : []);
    const providedTagIds = [];
    const providedTagNames = [];
    let tagsBeingSet = false;

    if (bookData.tagIds) {
        tagsBeingSet = true;
        toArray(bookData.tagIds).forEach(t => { if (mongoose.isValidObjectId(String(t))) providedTagIds.push(String(t)); });
    }
    if (bookData.tagNames) {
        tagsBeingSet = true;
        toArray(bookData.tagNames).forEach(t => { const s = String(t).trim().toLowerCase(); if (s) providedTagNames.push(s); });
    }
    if (bookData.tags) {
        tagsBeingSet = true;
        toArray(bookData.tags).forEach(t => {
            const s = String(t).trim();
            if (mongoose.isValidObjectId(s)) providedTagIds.push(s);
            else if (s) providedTagNames.push(s.toLowerCase());
        });
    }

    if (tagsBeingSet) {
        // Create/lookup tag ids for provided names
        if (providedTagNames.length > 0) {
            const uniqueNames = Array.from(new Set(providedTagNames));
            const tagOps = uniqueNames.map(async (name) => {
                const tag = await Tag.findOneAndUpdate(
                    { name },
                    { $setOnInsert: { name } },
                    { upsert: true, new: true }
                );
                return tag._id.toString();
            });
            const generated = (await Promise.all(tagOps)).filter(Boolean);
            bookData.tags = Array.from(new Set([...providedTagIds, ...generated]));
        } else {
            // If only ids provided, set tags to those ids
            bookData.tags = Array.from(new Set(providedTagIds));
        }
    }
    // --- End Tag Logic ---

    // Explicitly handle boolean fields to prevent incorrect truthy/falsy values
    if (bookData.isFeatured !== undefined) {
        // Accept 'true'/'false' strings, '1'/'0', numbers, and booleans
        if (typeof bookData.isFeatured === 'string') {
            bookData.isFeatured = ['true', '1', 'yes'].includes(bookData.isFeatured.toLowerCase());
        } else {
            bookData.isFeatured = !!bookData.isFeatured;
        }
    }
    if (bookData.isBestSeller !== undefined) {
        if (typeof bookData.isBestSeller === 'string') {
            bookData.isBestSeller = ['true', '1', 'yes'].includes(bookData.isBestSeller.toLowerCase());
        } else {
            bookData.isBestSeller = !!bookData.isBestSeller;
        }
    }

    // Parse numeric fields if present to ensure validation during update
    ['numberOfPages', 'price', 'stock'].forEach(field => {
        if (bookData[field] !== undefined && bookData[field] !== null && bookData[field] !== '') {
            const n = Number(bookData[field]);
            if (!isNaN(n)) bookData[field] = n;
        }
    });

    const updatedBook = await Book.findByIdAndUpdate(
        bookId,
        { $set: bookData },
        { new: true, runValidators: true }
    ).populate("tags").populate("category", "name parentCategory");

    clearBookCaches(bookId);
    return updatedBook;
};

const deleteBook = async (bookId, user) => {
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID format.");
    }

    const bookToDelete = await Book.findById(bookId);
    if (!bookToDelete) {
        throw new ApiError(404, "Book not found.");
    }

    if (bookToDelete.uploadedBy.toString() !== user._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this book.");
    }

    await Book.findByIdAndDelete(bookId);

    clearBookCaches(bookId);
};

export default {
    createBook,
    getAllBooks,
    getAdminBooks,
    getBookById,
    getNewReleases, 
    updateBookDetails,
    deleteBook,
};