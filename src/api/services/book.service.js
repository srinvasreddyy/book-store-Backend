import { Book } from "../models/book.model.js";
import { Tag } from "../models/tag.model.js";
import { Category } from "../models/category.model.js";
import { SubCategory } from "../models/subCategory.model.js";
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
        title, author, isbn, publisher, numberOfPages, category, subCategory, format,
        language, shortDescription, fullDescription, tags, price, stock,
        deliveryCharge
    } = bookData;

    const isFeatured = bookData.isFeatured === 'true' || bookData.isFeatured === true;
    const isBestSeller = bookData.isBestSeller === 'true' || bookData.isBestSeller === true;

    // Basic Validation
    const requiredFields = { title, author, publisher, category, format, language, shortDescription, fullDescription };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === "") {
            throw new ApiError(400, `${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
        }
    }

    if (!['Hardcover', 'Paperback'].includes(format)) {
        throw new ApiError(400, "Invalid format.");
    }

    // Numeric Validation
    [numberOfPages, price, stock, deliveryCharge].forEach((val, index) => {
        const fieldNames = ['numberOfPages', 'price', 'stock', 'deliveryCharge'];
        if (val === undefined || isNaN(Number(val)) || Number(val) < 0) {
             throw new ApiError(400, `${fieldNames[index]} must be a valid non-negative number.`);
        }
    });

    // File Validation
    // Images are now optional. If provided, must not exceed 10.
    if (files?.coverImages && files.coverImages.length > 10) {
        throw new ApiError(400, "Max 10 cover images.");
    }

    // Category Validation
    if (!mongoose.isValidObjectId(category)) throw new ApiError(400, "Invalid category ID.");
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) throw new ApiError(404, "Category not found.");

    // SubCategory Validation
    let validSubCategoryId = null;
    if (subCategory && subCategory !== 'null' && subCategory !== '') {
        if (!mongoose.isValidObjectId(subCategory)) throw new ApiError(400, "Invalid subcategory ID.");
        const subDoc = await SubCategory.findById(subCategory);
        if (!subDoc) throw new ApiError(404, "Subcategory not found.");
        if (subDoc.parentCategory.toString() !== category.toString()) {
            throw new ApiError(400, "Subcategory does not belong to selected parent category.");
        }
        validSubCategoryId = subDoc._id;
    }

    // ISBN Check (Optional, but we still check for duplicates if provided)
    if (isbn && isbn.trim() !== "") {
        if (await Book.findOne({ isbn })) throw new ApiError(409, "ISBN already exists.");
    }

    // Tag Logic
    let tagIds = [];
    if (tags || bookData.tagIds || bookData.tagNames) {
         const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
         let pIds = toArray(bookData.tagIds).filter(t => mongoose.isValidObjectId(t));
         let pNames = toArray(bookData.tagNames).map(t => String(t).trim().toLowerCase()).filter(Boolean);
         
         // Support legacy 'tags' field (CSV or mixed array)
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
        imageUrls = (await Promise.all(files.coverImages.map(f => uploadOnCloudinary(f.buffer))))
            .map(r => { if (!r?.url) throw new ApiError(500, "Image upload failed"); return r.url; });
    }
    
    let samplePdfUrl = null;
    if (files.samplePdf?.[0]) {
        const r = await uploadOnCloudinary(files.samplePdf[0].buffer);
        if (!r?.url) throw new ApiError(500, "PDF upload failed");
        samplePdfUrl = r.url;
    }

    const book = await Book.create({
        title, author, isbn, publisher, numberOfPages,
        category: categoryDoc._id,
        subCategory: validSubCategoryId,
        format, language, shortDescription, fullDescription,
        tags: tagIds, price, deliveryCharge, stock,
        coverImages: imageUrls, samplePdfUrl,
        uploadedBy: user._id, isFeatured, isBestSeller
    });

    clearBookCaches();
    return await Book.findById(book._id).populate(["tags", "category", "subCategory"]);
};

const getAllBooks = async (queryParams) => {
    const cacheKey = `allBooks_${JSON.stringify(queryParams)}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const { page = 1, limit = 10, category, subCategory, search, sortBy, sortOrder = 'asc', tags, isBestSeller } = queryParams;
    const match = {};

    if (search) match.$or = [{ title: { $regex: search, $options: 'i' } }, { author: { $regex: search, $options: 'i' } }];
    if (category && mongoose.isValidObjectId(category)) match.category = new mongoose.Types.ObjectId(category);
    if (subCategory && mongoose.isValidObjectId(subCategory)) match.subCategory = new mongoose.Types.ObjectId(subCategory);
    if (isBestSeller !== undefined) match.isBestSeller = (isBestSeller === 'true' || isBestSeller === true);

    if (tags) {
        const tagIds = (await Tag.find({ name: { $in: tags.split(',').map(t => t.trim().toLowerCase()) } }).select('_id')).map(t => t._id);
        if (tagIds.length) match.tags = { $in: tagIds };
    }

    const aggregate = Book.aggregate([{ $match: match }]);
    if (sortBy) aggregate.append({ $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } });

    const books = await Book.aggregatePaginate(aggregate, {
        page: parseInt(page), limit: parseInt(limit),
        populate: [{ path: "tags" }, { path: "category", select: "name" }, { path: "subCategory", select: "name" }]
    });

    cache.set(cacheKey, books);
    return books;
};

const getBookById = async (bookId) => {
    if (!mongoose.isValidObjectId(bookId)) throw new ApiError(400, "Invalid ID.");
    const cacheKey = `book_${bookId}`;
    if (cache.has(cacheKey)) return cache.get(cacheKey);

    const book = await Book.findById(bookId).populate(["tags", "category", "subCategory"]);
    if (!book) throw new ApiError(404, "Book not found.");
    
    cache.set(cacheKey, book);
    return book;
};

const updateBookDetails = async (bookId, bookData, user, files) => {
    if (!mongoose.isValidObjectId(bookId)) throw new ApiError(400, "Invalid ID.");
    const book = await Book.findById(bookId);
    if (!book) throw new ApiError(404, "Book not found.");
    
    // Ensure critical fields aren't wiped if not provided in update
    delete bookData.uploadedBy; 

    // Category & SubCategory Integrity Check
    const newCatId = bookData.category || book.category.toString();
    
    if (bookData.category && bookData.category !== book.category.toString()) {
         if (!await Category.exists({ _id: bookData.category })) throw new ApiError(404, "New category not found.");
    }

    if (bookData.subCategory !== undefined) {
        if (bookData.subCategory && bookData.subCategory !== 'null') {
            const sub = await SubCategory.findById(bookData.subCategory);
            if (!sub) throw new ApiError(404, "Subcategory not found.");
            if (sub.parentCategory.toString() !== newCatId) {
                throw new ApiError(400, "Subcategory must belong to the book's category.");
            }
        } else {
            bookData.subCategory = null;
        }
    } else if (bookData.category && book.subCategory) {
        // If category changed but subCategory wasn't explicitly updated, check if old sub is still valid.
        const oldSub = await SubCategory.findById(book.subCategory);
        if (oldSub && oldSub.parentCategory.toString() !== newCatId) {
            bookData.subCategory = null; // Invalidate incompatible subcategory
        }
    }

    // ROBUST IMAGE UPDATE MECHANISM
    // 1. Identify images to keep (frontend should send array of URLs to keep in bookData.coverImages)
    // If bookData.coverImages is NOT provided, we assume we keep ALL existing images.
    let imagesToKeep = book.coverImages;
    if (bookData.coverImages !== undefined) {
         const providedList = Array.isArray(bookData.coverImages) ? bookData.coverImages : [bookData.coverImages];
         // Security: Only allow keeping images that genuinely belonged to this book
         imagesToKeep = providedList.filter(url => typeof url === 'string' && book.coverImages.includes(url));
    }

    // 2. Upload NEW images
    let newImageUrls = [];
    if (files?.coverImages?.length) {
         newImageUrls = (await Promise.all(files.coverImages.map(f => uploadOnCloudinary(f.buffer))))
             .map(r => r.url);
    }

    // 3. Combine and Validate Total
    const finalCoverImages = [...imagesToKeep, ...newImageUrls];
    if (finalCoverImages.length > 10) {
        throw new ApiError(400, `Cannot have more than 10 cover images. You kept ${imagesToKeep.length} and uploaded ${newImageUrls.length}.`);
    }
    // Images are optional now, so no minimum check.
    bookData.coverImages = finalCoverImages;

    // Update basic fields
    const updated = await Book.findByIdAndUpdate(bookId, { $set: bookData }, { new: true, runValidators: true })
        .populate(["tags", "category", "subCategory"]);
    
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
            { path: "category", select: "name" },
            { path: "subCategory", select: "name" }
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
            { path: "category", select: "name" },
            { path: "subCategory", select: "name" }
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