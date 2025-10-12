import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Order } from "../models/order.model.js";
import { Discount } from "../models/discount.model.js";
import { Book } from "../models/book.model.js";
import { HANDLING_FEE, BASE_DELIVERY_FEE } from "../../constants.js";
import Razorpay from "razorpay";
import mongoose from "mongoose";

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const initiateOrder = asyncHandler(async (req, res) => {
    const { couponCode, paymentMethod } = req.body;
    const userId = req.user._id;
    const now = new Date();

    if (!paymentMethod) {
        throw new ApiError(400, "Payment method is required.");
    }

    const cart = await Cart.findOne({ user: userId }).populate("items.book");
    if (!cart || cart.items.length === 0) {
        throw new ApiError(400, "Your cart is empty");
    }

    // --- 0. Pre-order Stock Validation ---
    for (const item of cart.items) {
        if (item.book.stock < item.quantity) {
            throw new ApiError(400, `The item '${item.book.title}' is out of stock or the requested quantity is not available.`);
        }
    }


    // --- 1. Calculate Pricing ---
    let subtotal = 0;
    const orderedItems = cart.items.map(item => {
        subtotal += item.book.price * item.quantity;
        return {
            book: item.book._id,
            quantity: item.quantity,
            priceAtPurchase: item.book.price,
            uploadedBy: item.book.uploadedBy,
        };
    });

    let discountAmount = 0;
    let appliedDiscount = null;
    let deliveryFee = BASE_DELIVERY_FEE;

    if (couponCode) {
        const discount = await Discount.findOne({ couponCode: couponCode.toUpperCase() });

        // Basic validation (full validation happens before payment)
        if (discount && discount.isActive && subtotal >= discount.minCartValue) {
            if (discount.type === 'PERCENTAGE') {
                discountAmount = subtotal * (discount.value / 100);
            } else if (discount.type === 'FIXED_AMOUNT') {
                discountAmount = discount.value;
            } else if (discount.type === 'FREE_DELIVERY') {
                deliveryFee = 0;
            }
            appliedDiscount = discount._id;
        }
    }

    const totalAfterDiscount = Math.max(0, subtotal - discountAmount);
    const finalAmount = totalAfterDiscount + HANDLING_FEE + deliveryFee;

    // --- 2. Create Order in 'PENDING' state ---
    const order = await Order.create({
        user: userId,
        items: orderedItems,
        subtotal,
        discountAmount,
        handlingFee: HANDLING_FEE,
        deliveryFee,
        finalAmount,
        appliedDiscount,
        paymentMethod,
        paymentStatus: 'PENDING'
    });
    
    // --- 3. Handle Payment Method ---
    if (paymentMethod === 'CASH_ON_DELIVERY') {
        order.status = 'PROCESSING';
        order.paymentStatus = 'PENDING'; // Payment will be completed on delivery
        await order.save();

        // Decrement stock for COD
        for (const item of orderedItems) {
            await Book.findByIdAndUpdate(item.book, { $inc: { stock: -item.quantity } });
        }
        
        // Clear cart for COD
        await Cart.findOneAndUpdate({ user: userId }, { $set: { items: [] } });

        return res.status(201).json(new ApiResponse(201, order, "Order placed successfully with Cash on Delivery."));

    } else { // For all online methods, create a Razorpay order
        const options = {
            amount: Math.round(finalAmount * 100), // Amount in the smallest currency unit
            currency: "INR",
            receipt: order._id.toString(),
        };

        const razorpayOrder = await instance.orders.create(options);
        if (!razorpayOrder) {
            throw new ApiError(500, "Failed to create Razorpay order.");
        }

        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        return res.status(201).json(new ApiResponse(201, {
            order,
            razorpayOrder,
        }, "Order initiated. Proceed to payment."));
    }
});

export { initiateOrder };