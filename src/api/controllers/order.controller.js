import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Discount } from "../models/discount.model.js";

const checkout = asyncHandler(async (req, res) => {
    const { couponCode } = req.body;
    const userId = req.user._id;

    const cart = await Cart.findOne({ user: userId }).populate("items.book");

    if (!cart || cart.items.length === 0) {
        throw new ApiError(400, "Your cart is empty");
    }

    let subtotal = 0;
    const orderedItems = cart.items.map(item => {
        subtotal += item.book.price * item.quantity;
        return {
            book: item.book._id,
            quantity: item.quantity,
            priceAtPurchase: item.book.price,
        };
    });

    let totalAmount = subtotal;
    let appliedDiscount = null;

    if (couponCode) {
        const discount = await Discount.findOne({ couponCode: couponCode.toUpperCase(), isActive: true });
        if (discount) {
            appliedDiscount = discount._id;
            if (discount.type === 'PERCENTAGE') {
                totalAmount = subtotal - (subtotal * discount.value / 100);
            } else if (discount.type === 'FIXED_AMOUNT') {
                totalAmount = subtotal - discount.value;
            }
        } else {
            throw new ApiError(400, "Invalid coupon code");
        }
    }

    const order = await Order.create({
        user: userId,
        items: orderedItems,
        subtotal,
        appliedDiscount,
        totalAmount: Math.max(0, totalAmount), // Ensure total is not negative
        status: 'COMPLETED' // Simulate successful payment
    });
    
    // Clear the cart after order creation
    await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });

    return res
        .status(201)
        .json(new ApiResponse(201, order, "Order placed successfully"));
});

export { checkout };