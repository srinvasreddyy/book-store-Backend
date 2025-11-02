import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

const getCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id }).populate({
    path: "items.book",
    select: "title author price stock coverImage deliveryCharge",
  });

  if (!cart) {
    // If no cart exists, create a new empty one for the user.
    const newCart = await Cart.create({ user: req.user._id, items: [] });
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          newCart,
          "Cart is empty. A new cart has been created for you.",
        ),
      );
  }

  // Add stock availability information to each item
  const itemsWithStockInfo = cart.items.map((item) => ({
    ...item.toObject(),
    isAvailable: item.book.stock >= item.quantity,
    availableStock: item.book.stock,
  }));

  const cartWithStockInfo = {
    ...cart.toObject(),
    items: itemsWithStockInfo,
  };

  return res
    .status(200)
    .json(
      new ApiResponse(200, cartWithStockInfo, "Cart fetched successfully."),
    );
});

const addItemToCart = asyncHandler(async (req, res) => {
  const { bookId, quantity } = req.body;

  // --- Input Validation ---
  if (!bookId) {
    throw new ApiError(400, "Book ID is required.");
  }
  if (!mongoose.isValidObjectId(bookId)) {
    throw new ApiError(400, "Invalid book ID format.");
  }
  const parsedQuantity = parseInt(quantity, 10);
  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    throw new ApiError(400, "Invalid quantity. Must be a positive number.");
  }
  // --- End Validation ---

  const book = await Book.findById(bookId);
  if (!book) {
    throw new ApiError(404, "Book not found.");
  }

  let cart = await Cart.findOne({ user: req.user._id });

  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }

  const existingItemIndex = cart.items.findIndex(
    (item) => item.book.toString() === bookId,
  );
  let totalQuantity = parsedQuantity;

  if (existingItemIndex > -1) {
    totalQuantity += cart.items[existingItemIndex].quantity;
  }

  if (book.stock < totalQuantity) {
    throw new ApiError(
      400,
      `Not enough stock. Only ${book.stock} items are available, but you are trying to add ${totalQuantity}.`,
    );
  }

  if (existingItemIndex > -1) {
    // Update quantity if item already in cart
    cart.items[existingItemIndex].quantity = totalQuantity;
  } else {
    // Add new item to cart
    cart.items.push({ book: bookId, quantity: parsedQuantity });
  }

  await cart.save();
  const populatedCart = await cart.populate({
    path: "items.book",
    select: "title author price stock coverImage deliveryCharge",
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, populatedCart, "Item added to cart successfully."),
    );
});

const removeItemFromCart = asyncHandler(async (req, res) => {
  const { bookId } = req.params;

  // --- Input Validation ---
  if (!mongoose.isValidObjectId(bookId)) {
    throw new ApiError(400, "Invalid book ID format.");
  }
  // --- End Validation ---

  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { items: { book: bookId } } },
    { new: true },
  ).populate({
    path: "items.book",
    select: "title author price stock coverImage deliveryCharge",
  });

  if (!cart) {
    throw new ApiError(404, "Cart not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Item removed from cart successfully."));
});

const clearCart = asyncHandler(async (req, res) => {
  const cart = await Cart.findOneAndUpdate(
    { user: req.user._id },
    { $set: { items: [] } },
    { new: true },
  );

  if (!cart) {
    // This case is unlikely if user is authenticated, but good practice
    const newCart = await Cart.create({ user: req.user._id, items: [] });
    return res
      .status(200)
      .json(new ApiResponse(200, newCart, "Cart is already empty."));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "Cart cleared successfully."));
});

export { getCart, addItemToCart, removeItemFromCart, clearCart };