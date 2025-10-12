import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

const getCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id }).populate("items.book");

    if (!cart) {
        // If no cart, create one and return it
        const newCart = await Cart.create({ user: req.user._id, items: [] });
        return res.status(200).json(new ApiResponse(200, newCart, "Cart is empty"));
    }

    // Add stock availability information
    const itemsWithStockInfo = cart.items.map(item => ({
        ...item.toObject(),
        isAvailable: item.book.stock >= item.quantity,
        availableStock: item.book.stock
    }));

    const cartWithStockInfo = {
        ...cart.toObject(),
        items: itemsWithStockInfo
    };


    return res.status(200).json(new ApiResponse(200, cartWithStockInfo, "Cart fetched successfully"));
});

const addItemToCart = asyncHandler(async (req, res) => {
    const { bookId, quantity } = req.body;
    const parsedQuantity = parseInt(quantity, 10);

    if (!mongoose.isValidObjectId(bookId) || !parsedQuantity || parsedQuantity < 1) {
        throw new ApiError(400, "Valid book ID and quantity are required");
    }

    const book = await Book.findById(bookId);
    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    if (book.stock < parsedQuantity) {
        throw new ApiError(400, `Only ${book.stock} items are available in stock.`);
    }

    let cart = await Cart.findOne({ user: req.user._id });

    if (!cart) {
        cart = await Cart.create({ user: req.user._id, items: [] });
    }

    const existingItemIndex = cart.items.findIndex(item => item.book.toString() === bookId);

    if (existingItemIndex > -1) {
        // Update quantity if item already in cart
        const newQuantity = cart.items[existingItemIndex].quantity + parsedQuantity;
        if (book.stock < newQuantity) {
            throw new ApiError(400, `Cannot add more items than available in stock. You already have ${cart.items[existingItemIndex].quantity} in cart.`);
        }
        cart.items[existingItemIndex].quantity = newQuantity;
    } else {
        // Add new item to cart
        cart.items.push({ book: bookId, quantity: parsedQuantity });
    }

    await cart.save();

    const populatedCart = await cart.populate("items.book");

    return res.status(200).json(new ApiResponse(200, populatedCart, "Item added to cart successfully"));
});

const removeItemFromCart = asyncHandler(async (req, res) => {
    const { bookId } = req.params;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }

    const cart = await Cart.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { items: { book: bookId } } },
        { new: true }
    ).populate("items.book");

    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    return res.status(200).json(new ApiResponse(200, cart, "Item removed from cart successfully"));
});

const clearCart = asyncHandler(async (req, res) => {
    const cart = await Cart.findOneAndUpdate(
        { user: req.user._id },
        { $set: { items: [] } },
        { new: true }
    );

    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    return res.status(200).json(new ApiResponse(200, cart, "Cart cleared successfully"));
});

export { getCart, addItemToCart, removeItemFromCart, clearCart };