import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Book } from "../models/book.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

const createBook = asyncHandler(async (req, res) => {
    const { title, description, author, price, stock, category, isbn, publisher } = req.body;

    if ([title, description, author, price, stock, category].some((field) => !field || String(field).trim() === "")) {
        throw new ApiError(400, "All required fields must be provided");
    }

    const coverImageLocalPath = req.file?.path;
    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover image file is required");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);
    if (!coverImage) {
        throw new ApiError(500, "Failed to upload cover image");
    }

    const book = await Book.create({
        title,
        description,
        author,
        price,
        stock,
        category,
        isbn,
        publisher,
        coverImage: coverImage.url,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, book, "Book created successfully"));
});

const getAllBooks = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType } = req.query;
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
    };

    const aggregate = Book.aggregate();
    // Add search/filter logic here in the future if needed

    const books = await Book.aggregatePaginate(aggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, books, "Books fetched successfully"));
});

const getBookById = asyncHandler(async (req, res) => {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }
    
    const book = await Book.findById(bookId).populate("category", "name");

    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, book, "Book fetched successfully"));
});

const updateBookDetails = asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const { title, description, author, price, stock, category, isbn, publisher } = req.body;
    
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findByIdAndUpdate(
        bookId,
        {
            $set: { title, description, author, price, stock, category, isbn, publisher }
        },
        { new: true }
    );

    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, book, "Book details updated successfully"));
});

const deleteBook = asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    
    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const book = await Book.findByIdAndDelete(bookId);

    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    // Note: Deleting the cover image from Cloudinary is a good practice for production.

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Book deleted successfully"));
});

export {
    createBook,
    getAllBooks,
    getBookById,
    updateBookDetails,
    deleteBook
};