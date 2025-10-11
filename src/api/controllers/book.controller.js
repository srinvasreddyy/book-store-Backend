import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Book } from "../models/book.model.js";
import { Tag } from "../models/tag.model.js";
import { Category } from "../models/category.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

const createBook = asyncHandler(async (req, res) => {
    const {
        title, author, isbn, publisher, numberOfPages, category, format,
        language, shortDescription, fullDescription, tags, price, stock
    } = req.body;

    const requiredFields = { title, author, isbn, publisher, numberOfPages, category, format, language, shortDescription, fullDescription, price, stock };
    for (const [field, value] of Object.entries(requiredFields)) {
        if (!value || String(value).trim() === "") {
            throw new ApiError(400, `${field.charAt(0).toUpperCase() + field.slice(1)} is required.`);
        }
    }
    
    // Validate category
    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) throw new ApiError(404, "Category not found.");
    if (categoryDoc.owner && categoryDoc.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You do not have permission to use this category.");
    }
    
    
    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required");
    }

    const existingBook = await Book.findOne({ isbn });
    if (existingBook) {
        throw new ApiError(409, "A book with this ISBN already exists.");
    }

    let tagIds = [];
    if (tags && tags.length > 0) {
        const tagOperations = tags.map(async (tagName) => {
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

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage || !coverImage.url) {
        throw new ApiError(500, "Failed to upload cover image to Cloudinary");
    }

    const book = await Book.create({
        title,
        author,
        isbn,
        publisher,
        numberOfPages,
        category, // This is now an ObjectId
        format,
        language,
        shortDescription,
        fullDescription,
        tags: tagIds,
        price,
        stock,
        coverImage: coverImage.url,
        uploadedBy: req.user._id,
    });

    const createdBook = await Book.findById(book._id).populate("tags").populate("category");

    if (!createdBook) {
        throw new ApiError(500, "Something went wrong while creating the book");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, createdBook, "Book created successfully"));
});

const getAllBooks = asyncHandler(async (req, res) => {
    // ... (logic remains largely the same, but now populates category)
    const { page = 1, limit = 10, category, search, sortBy, sortOrder = 'asc', tags } = req.query;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [{ path: "tags" }, { path: "category" }]
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
             pipeline.push({
                $match: {
                    tags: { $in: tagIds }
                }
            });
        }
    }

    if (sortBy) {
        const order = sortOrder === 'desc' ? -1 : 1;
        pipeline.push({ $sort: { [sortBy]: order } });
    }

    const aggregate = Book.aggregate(pipeline);
    const books = await Book.aggregatePaginate(aggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, books, "Books fetched successfully"));
});

const getAdminBooks = asyncHandler(async (req, res) => {
    // ... (updated to populate category)
    const { page = 1, limit = 10, sortBy, sortOrder = 'asc' } = req.query;
    const adminId = req.user._id;

    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        populate: [{ path: "tags" }, { path: "category" }],
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

    return res.status(200).json(new ApiResponse(200, books, "Admin's books fetched successfully"));
});

const getBookById = asyncHandler(async (req, res) => {
    // ... (updated to populate category)
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findById(bookId).populate("tags").populate("category");

    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, book, "Book fetched successfully"));
});

const updateBookDetails = asyncHandler(async (req, res) => {
    // ... (updated to populate category)
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const bookToUpdate = await Book.findById(bookId);
    if (!bookToUpdate) {
        throw new ApiError(404, "Book not found");
    }

    if (bookToUpdate.uploadedBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Forbidden: You can only edit your own books.");
    }

    const updatedBook = await Book.findByIdAndUpdate(
        bookId,
        { $set: req.body },
        { new: true }
    ).populate("tags").populate("category");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedBook, "Book details updated successfully"));
});

// ... (deleteBook remains the same)
const deleteBook = asyncHandler(async (req, res) => {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const bookToDelete = await Book.findById(bookId);
    if (!bookToDelete) {
        throw new ApiError(404, "Book not found");
    }

    if (bookToDelete.uploadedBy.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Forbidden: You can only delete your own books.");
    }

    await Book.findByIdAndDelete(bookId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Book deleted successfully"));
});

export {
    createBook,
    getAllBooks,
    getAdminBooks,
    getBookById,
    updateBookDetails,
    deleteBook
};