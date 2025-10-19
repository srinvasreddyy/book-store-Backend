import { Book } from "../models/book.model.js";
import { Tag } from "../models/tag.model.js";
import { Category } from "../models/category.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiError } from "../../utils/ApiError.js";
import mongoose from "mongoose";
import cache from "../../utils/cache.js";

const createBook = async (bookData, user, files) => {
    const {
        title, author, isbn, publisher, numberOfPages, category, format,
        language, shortDescription, fullDescription, tags, price, stock,
    } = bookData;

    const isFeatured = bookData.isFeatured === 'true' || bookData.isFeatured === true;
    const isBestSeller = bookData.isBestSeller === 'true' || bookData.isBestSeller === true;


    // --- Comprehensive Input Validation ---
    const requiredFields = { title, author, isbn, publisher, category, format, language, shortDescription, fullDescription };
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

    let categoryDoc = await Category.findOne({
      $or: [
        { _id: mongoose.isValidObjectId(category) ? category : null },
        { name: category, owner: user?._id },
        { name: category, isDefault: true }
      ],
    });

    if (!categoryDoc) {
      categoryDoc = await Category.create({
        name: category,
        owner: user?._id
      });
    }

    const existingBook = await Book.findOne({ isbn });
    if (existingBook) {
        throw new ApiError(409, "A book with this ISBN already exists.");
    }

    let tagIds = [];
    if (tags && tags.length > 0) {
        const tagList = Array.isArray(tags) ? tags : [tags];
        const tagOperations = tagList.map(async (tagName) => {
            const name = tagName.trim().toLowerCase();
            if (name) {
                const tag = await Tag.findOneAndUpdate(
                    { name },
                    { $setOnInsert: { name } },
                    { upsert: true, new: true }
                );
                return tag._id;
            }
        });
        tagIds = (await Promise.all(tagOperations)).filter(Boolean);
    }

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

    cache.del("allBooks");
    return createdBook;
};

const getAllBooks = async (queryParams) => {
    const cacheKey = `allBooks_${JSON.stringify(queryParams)}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    const { page = 1, limit = 10, category, search, sortBy, sortOrder = 'asc', tags } = queryParams;

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
            matchStage.category = new mongoose.Types.ObjectId(category);
        } else {
            return { docs: [], totalDocs: 0, limit, page, totalPages: 1, nextPage: null, prevPage: null };
        }
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
    if (cache.has(bookId)) {
        return cache.get(bookId);
    }
    const book = await Book.findById(bookId).populate("tags").populate("category", "name");
    if (!book) {
        throw new ApiError(404, "Book not found.");
    }
    cache.set(bookId, book);
    return book;
};

const updateBookDetails = async (bookId, bookData, user, files) => {
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID format.");
    }

    if (Object.keys(bookData).length === 0 && (!files || Object.keys(files).length === 0)) {
        throw new ApiError(400, "No fields provided to update.");
    }
    
    delete bookData.uploadedBy;
    delete bookData.isbn; 

    const bookToUpdate = await Book.findById(bookId);
    if (!bookToUpdate) {
        throw new ApiError(404, "Book not found.");
    }

    if (bookToUpdate.uploadedBy.toString() !== user._id.toString()) {
        throw new ApiError(403, "You do not have permission to edit this book.");
    }
    
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
    
    // Explicitly handle boolean fields to prevent incorrect truthy/falsy values
    if (bookData.isFeatured !== undefined) {
        bookData.isFeatured = !!bookData.isFeatured;
    }
    if (bookData.isBestSeller !== undefined) {
        bookData.isBestSeller = !!bookData.isBestSeller;
    }

    const updatedBook = await Book.findByIdAndUpdate(
        bookId,
        { $set: bookData },
        { new: true, runValidators: true }
    ).populate("tags").populate("category", "name");

    cache.del("allBooks");
    cache.del(bookId);
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

    cache.del("allBooks");
    cache.del(bookId);
};

export default {
    createBook,
    getAllBooks,
    getAdminBooks,
    getBookById,
    updateBookDetails,
    deleteBook,
};