import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Discount } from "../models/discount.model.js";
import mongoose from "mongoose";

const createDiscount = asyncHandler(async (req, res) => {
    const { 
        couponCode, description, type, value, minCartValue, 
        maxUses, maxUsesPerUser, startDate, endDate 
    } = req.body;
    const adminId = req.user._id;

    if (!couponCode || !description || !type || !maxUses || !maxUsesPerUser) {
        throw new ApiError(400, "Coupon code, description, type, max uses, and max uses per user are required.");
    }
    if (type !== 'FREE_DELIVERY' && (!value || value <= 0)) {
        throw new ApiError(400, "A value is required for this discount type.");
    }

    const existingDiscount = await Discount.findOne({ couponCode });
    if (existingDiscount) {
        throw new ApiError(409, "A discount with this coupon code already exists.");
    }

    const discount = await Discount.create({
        couponCode,
        description,
        type,
        value: type === 'FREE_DELIVERY' ? 0 : value,
        minCartValue,
        maxUses,
        maxUsesPerUser,
        startDate,
        endDate,
        owner: adminId,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, discount, "Discount created successfully"));
});

const getMyDiscounts = asyncHandler(async (req, res) => {
    const discounts = await Discount.find({ owner: req.user._id }).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, discounts, "Your discounts fetched successfully"));
});

const validateDiscount = asyncHandler(async (req, res) => {
    const { couponCode, cartSubtotal } = req.body;
    const userId = req.user?._id; // User might not be logged in when checking
    const now = new Date();

    if (!couponCode || cartSubtotal === undefined) {
        throw new ApiError(400, "Coupon code and cart subtotal are required.");
    }

    const discount = await Discount.findOne({
        couponCode: couponCode.toUpperCase(),
        isActive: true,
    });

    if (!discount) throw new ApiError(404, "Invalid coupon code.");
    if (discount.timesUsed >= discount.maxUses) throw new ApiError(400, "This coupon has reached its usage limit.");
    if (cartSubtotal < discount.minCartValue) throw new ApiError(400, `Cart must be at least $${discount.minCartValue} to use this coupon.`);
    
    // Date validation
    if (discount.startDate && discount.startDate > now) throw new ApiError(400, "This coupon is not yet active.");
    if (discount.endDate && discount.endDate < now) throw new ApiError(400, "This coupon has expired.");

    // Per-user usage validation
    if (userId) {
        const userUsage = discount.usedBy.find(u => u.user.toString() === userId.toString());
        if (userUsage && userUsage.count >= discount.maxUsesPerUser) {
            throw new ApiError(400, "You have already used this coupon the maximum number of times.");
        }
    }

    return res.status(200).json(new ApiResponse(200, discount, "Coupon is valid and applicable."));
});


const updateDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;
    
    const discount = await Discount.findOneAndUpdate(
        { _id: discountId, owner: req.user._id },
        { $set: req.body }, 
        { new: true }
    );

    if (!discount) {
        throw new ApiError(404, "Discount not found or you don't have permission to edit it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, discount, "Discount updated successfully"));
});

const deleteDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;

    const discount = await Discount.findOneAndDelete({ _id: discountId, owner: req.user._id });

    if (!discount) {
        throw new ApiError(404, "Discount not found or you don't have permission to delete it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Discount deleted successfully"));
});

export {
    createDiscount,
    getMyDiscounts,
    validateDiscount,
    updateDiscount,
    deleteDiscount
};