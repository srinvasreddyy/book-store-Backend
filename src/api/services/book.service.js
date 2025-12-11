import { Book } from "../models/book.model.js";
import { Tag } from "../models/tag.model.js";
import { Category } from "../models/category.model.js";
// Removed SubCategory import as it is deprecated in the new architecture
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { ApiError } from "../../utils/ApiError.js";
import mongoose from "mongoose";
import cache from "../../utils/cache.js";

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
        deliveryCharge, salePrice, oldBook
    } = bookData;

    const isFeatured = bookData.isFeatured === 'true' || bookData.isFeatured === true;
    const isBestSeller = bookData.isBestSeller === 'true' || bookData.isBestSeller === true;
    const isOldBook = bookData.oldBook === 'true' || bookData.oldBook === true;

    // 1. Basic Validation - ONLY Mandatory Fields
    const requiredFields = { title, author };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === "") {
            throw new ApiError(400, `${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
        }
    }

    // 2. Format Validation (Only if provided)
    if (format && format.trim() !== "" && !['Hardcover', 'Paperback'].includes(format)) {
        throw new ApiError(400, "Invalid format. Must be 'Hardcover' or 'Paperback'.");
    }

    // 3. Numeric Validation (Mandatory fields: Price, Sale Price, Delivery Charge)
    if (price === undefined || price === '' || isNaN(Number(price)) || Number(price) < 0) {
        throw new ApiError(400, "Regular price is required and must be a valid non-negative number.");
    }
    
    if (deliveryCharge === undefined || deliveryCharge === '' || isNaN(Number(deliveryCharge)) || Number(deliveryCharge) < 0) {
         throw new ApiError(400, "Delivery charge is required and must be a valid non-negative number.");
    }

    if (salePrice === undefined || salePrice === '' || isNaN(Number(salePrice)) || Number(salePrice) < 0) {
        throw new ApiError(400, "Sale price is required and must be a valid non-negative number.");
    }

    // Optional Numeric Fields Validation
    if (numberOfPages && (isNaN(Number(numberOfPages)) || Number(numberOfPages) < 0)) {
        throw new ApiError(400, "Number of pages must be a valid non-negative number.");
    }

    if (stock && (isNaN(Number(stock)) || Number(stock) < 0)) {
        throw new ApiError(400, "Stock must be a valid non-negative number.");
    }

    // File Validation
    if (files?.coverImages && files.coverImages.length > 10) {
        throw new ApiError(400, "Max 10 cover images.");
    }

    // 4. Category Validation (Only if provided)
    let categoryId = undefined;
    if (category && category !== "undefined" && category !== "") {
        if (!mongoose.isValidObjectId(category)) throw new ApiError(400, "Invalid category ID.");
        const categoryDoc = await Category.findById(category);
        if (!categoryDoc) throw new ApiError(404, "Category not found.");
        categoryId = categoryDoc._id;
    }

    // ISBN Check (Optional but must be unique if provided)
    if (isbn && isbn.trim() !== "") {
        if (await Book.findOne({ isbn })) throw new ApiError(409, "ISBN already exists.");
    }

    // Tag Logic
    let tagIds = [];
    if (tags || bookData.tagIds || bookData.tagNames) {
         const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
         let pIds = toArray(bookData.tagIds).filter(t => mongoose.isValidObjectId(t));
         let pNames = toArray(bookData.tagNames).map(t => String(t).trim().toLowerCase()).filter(Boolean);
         
         if (tags) {
             const tagList = typeof tags === 'string' ? tags.split(',') : toArray(tags);
             tagList.forEach(t => {
                 const val = String(t).trim();
                 if (mongoose.isValidObjectId(val)) pIds.push(val);
                 else if (val) pNames.push(val.toLowerCase());
             });
         }
         
         if (pNames.length > 0) {
             const uniqueNames = [...new Set(pNames)];
             const tagOps = uniqueNames.map(name => Tag.findOneAndUpdate({ name }, { $setOnInsert: { name } }, { upsert: true, new: true }));
             const newTags = await Promise.all(tagOps);
             pIds.push(...newTags.map(t => t._id.toString()));
         }
         tagIds = [...new Set(pIds)];
    }

    // Image Upload
    let imageUrls = [];
    if (files?.coverImages) {
        imageUrls = (await Promise.all(files.coverImages.map(async (f) => {
             const result = await uploadOnCloudinary(f.path);
             if (!result?.url) throw new ApiError(500, `Image upload failed for ${f.originalname}`);
             return result.url;
        })));
    }
    
    // PDF Upload
    let samplePdfUrl = null;
    if (files.samplePdf?.[0]) {
        const r = await uploadOnCloudinary(files.samplePdf[0].path);
        if (!r?.url) throw new ApiError(500, "PDF upload failed");
        samplePdfUrl = r.url;
    }

    const book = await Book.create({
        title, 
        author, 
        isbn, 
        publisher, 
        numberOfPages: numberOfPages ? Number(numberOfPages) : undefined,
        category: categoryId,
        format, 
        language, 
        shortDescription, 
        fullDescription,
        tags: tagIds, 
        price, 
        deliveryCharge, 
        stock: stock ? Number(stock) : undefined,
        salePrice: Number(salePrice),
        coverImages: imageUrls, 
        samplePdfUrl,
        uploadedBy: user._id, 
        isFeatured, 
        isBestSeller, 
        oldBook: isOldBook
    });

    clearBookCaches();
    return await Book.findById(book._id).populate(["tags", "category"]);
};

const getAllBooks = async (queryParams) => {
    const cacheKey = `allBooks_${JSON.stringify(queryParams)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const { page = 1, limit = 10, category, search, sortBy, sortOrder = 'asc', tags, isBestSeller, oldBook } = queryParams;
    const match = {};

    if (search) match.$or = [{ title: { $regex: search, $options: 'i' } }, { author: { $regex: search, $options: 'i' } }];
    if (category && mongoose.isValidObjectId(category)) match.category = new mongoose.Types.ObjectId(category);
    if (isBestSeller !== undefined) match.isBestSeller = (isBestSeller === 'true' || isBestSeller === true);
    if (oldBook !== undefined) match.oldBook = (oldBook === 'true' || oldBook === true);

    if (tags) {
        const tagIds = (await Tag.find({ name: { $in: tags.split(',').map(t => t.trim().toLowerCase()) } }).select('_id')).map(t => t._id);
        if (tagIds.length) match.tags = { $in: tagIds };
    }

    const aggregate = Book.aggregate([{ $match: match }]);
    if (sortBy) aggregate.append({ $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } });

    const books = await Book.aggregatePaginate(aggregate, {
        page: parseInt(page), limit: parseInt(limit),
        populate: [{ path: "tags" }, { path: "category", select: "name" }]
    });

    cache.set(cacheKey, books);
    return books;
};

const getBookById = async (bookId) => {
    if (!mongoose.isValidObjectId(bookId)) throw new ApiError(400, "Invalid ID.");
    const cacheKey = `book_${bookId}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const book = await Book.findById(bookId).populate(["tags", "category"]);
    if (!book) throw new ApiError(404, "Book not found.");
    
    cache.set(cacheKey, book);
    return book;
};

const updateBookDetails = async (bookId, bookData, user, files) => {
    if (!mongoose.isValidObjectId(bookId)) throw new ApiError(400, "Invalid ID.");
    const book = await Book.findById(bookId);
    if (!book) throw new ApiError(404, "Book not found.");
    
    delete bookData.uploadedBy; 

    // Category Logic for Update (Optional)
    if (bookData.category && bookData.category !== "undefined" && bookData.category !== "") {
         if (bookData.category !== book.category?.toString()) {
              if (!await Category.exists({ _id: bookData.category })) throw new ApiError(404, "New category not found.");
         }
    }

    let imagesToKeep = book.coverImages;
    if (bookData.coverImages !== undefined) {
         const providedList = Array.isArray(bookData.coverImages) ? bookData.coverImages : [bookData.coverImages];
         imagesToKeep = providedList.filter(url => typeof url === 'string' && book.coverImages.includes(url));
    }

    let newImageUrls = [];
    if (files?.coverImages?.length) {
         newImageUrls = (await Promise.all(files.coverImages.map(async (f) => {
             const result = await uploadOnCloudinary(f.path);
             if (!result?.url) throw new ApiError(500, `Image upload failed for ${f.originalname}`);
             return result.url;
         })));
    }

    const finalCoverImages = [...imagesToKeep, ...newImageUrls];
    if (finalCoverImages.length > 10) {
        throw new ApiError(400, `Cannot have more than 10 cover images.`);
    }
    bookData.coverImages = finalCoverImages;

    const updated = await Book.findByIdAndUpdate(bookId, { $set: bookData }, { new: true, runValidators: true })
        .populate(["tags", "category"]);
    
    clearBookCaches(bookId);
    return updated;
};

const getAdminBooks = async (queryParams, user) => {
    const { page = 1, limit = 10, sortBy, sortOrder = 'asc' } = queryParams;
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [
            { path: "tags" },
            { path: "category", select: "name" }
        ],
        sort: { [sortBy || 'createdAt']: sortOrder === 'desc' ? -1 : 1 }
    };

    const aggregate = Book.aggregate([
        { $match: { uploadedBy: new mongoose.Types.ObjectId(user._id) } }
    ]);

    return await Book.aggregatePaginate(aggregate, options);
};

const getNewReleases = async (queryParams) => {
    const { page = 1, limit = 10 } = queryParams;
    const cacheKey = `newReleases_${page}_${limit}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [
            { path: "tags" },
            { path: "category", select: "name" }
        ],
        sort: { createdAt: -1 }
    };

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const aggregate = Book.aggregate([{ $match: { createdAt: { $gte: tenDaysAgo } } }]);
    const books = await Book.aggregatePaginate(aggregate, options);

    cache.set(cacheKey, books);
    return books;
};

const deleteBook = async (bookId, user) => {
    if (!mongoose.isValidObjectId(bookId)) throw new ApiError(400, "Invalid ID.");
    const book = await Book.findById(bookId);
    if (!book) throw new ApiError(404, "Book not found.");
    
    await Book.findByIdAndDelete(bookId);
    clearBookCaches(bookId);
};

export default { createBook, getAllBooks, getAdminBooks, getBookById, getNewReleases, updateBookDetails, deleteBook };