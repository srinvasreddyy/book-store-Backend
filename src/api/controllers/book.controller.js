import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import bookService from "../services/book.service.js";

const createBook = asyncHandler(async (req, res) => {
    const book = await bookService.createBook(req.body, req.user, req.files);
    return res.status(201).json(new ApiResponse(201, book, "Book created successfully"));
});

const getAllBooks = asyncHandler(async (req, res) => {
    const books = await bookService.getAllBooks(req.query);
    return res.status(200).json(new ApiResponse(200, books, "Books fetched successfully"));
});

const getBookById = asyncHandler(async (req, res) => {
    const book = await bookService.getBookById(req.params.bookId);
    return res.status(200).json(new ApiResponse(200, book, "Book fetched successfully"));
});

const updateBookDetails = asyncHandler(async (req, res) => {
    const book = await bookService.updateBookDetails(req.params.bookId, req.body, req.user, req.files);
    return res.status(200).json(new ApiResponse(200, book, "Book updated successfully"));
});

const deleteBook = asyncHandler(async (req, res) => {
    await bookService.deleteBook(req.params.bookId, req.user);
    return res.status(200).json(new ApiResponse(200, {}, "Book deleted successfully"));
});

const getAdminBooks = asyncHandler(async (req, res) => {
    const books = await bookService.getAdminBooks(req.query, req.user);
    return res.status(200).json(new ApiResponse(200, books, "Admin books fetched successfully"));
});

const getNewReleases = asyncHandler(async (req, res) => {
    const books = await bookService.getNewReleases(req.query);
    return res.status(200).json(new ApiResponse(200, books, "New releases fetched successfully"));
});

export {
    createBook, getAllBooks, getBookById, updateBookDetails,
    deleteBook, getAdminBooks, getNewReleases
};