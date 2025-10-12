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

    // --- Input Validation ---
    if (!couponCode || couponCode.trim() === "") throw new ApiError(400, "Coupon code is required.");
    if (!description || description.trim() === "") throw new ApiError(400, "Description is required.");
    
    const allowedTypes = ['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_DELIVERY'];
    if (!type || !allowedTypes.includes(type)) {
        throw new ApiError(400, `Discount type must be one of: ${allowedTypes.join(', ')}.`);
    }

    if (type !== 'FREE_DELIVERY') {
        if (value === undefined || isNaN(Number(value)) || Number(value) <= 0) {
            throw new ApiError(400, "A positive numeric value is required for this discount type.");
        }
    }
    
    const numericFields = { maxUses, maxUsesPerUser };
    for (const [field, val] of Object.entries(numericFields)) {
        if (val === undefined || isNaN(Number(val)) || Number(val) < 1) {
            throw new ApiError(400, `${field} must be a positive integer.`);
        }
    }
    // --- End Validation ---

    const existingDiscount = await Discount.findOne({ couponCode: couponCode.trim().toUpperCase() });
    if (existingDiscount) {
        throw new ApiError(409, "A discount with this coupon code already exists.");
    }

    const discount = await Discount.create({
        couponCode,
        description,
        type,
        value: type === 'FREE_DELIVERY' ? 0 : value,
        minCartValue: minCartValue || 0,
        maxUses,
        maxUsesPerUser,
        startDate,
        endDate,
        owner: adminId,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, discount, "Discount created successfully."));
});

const getMyDiscounts = asyncHandler(async (req, res) => {
    const discounts = await Discount.find({ owner: req.user._id }).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, discounts, "Your discounts fetched successfully."));
});

const validateDiscount = asyncHandler(async (req, res) => {
    const { couponCode, cartSubtotal } = req.body;
    const userId = req.user?._id;
    const now = new Date();

    // --- Input Validation ---
    if (!couponCode || couponCode.trim() === "") {
        throw new ApiError(400, "Coupon code is required.");
    }
    if (cartSubtotal === undefined || isNaN(Number(cartSubtotal)) || Number(cartSubtotal) < 0) {
        throw new ApiError(400, "A valid, non-negative cart subtotal is required.");
    }
    // --- End Validation ---

    const discount = await Discount.findOne({
        couponCode: couponCode.toUpperCase(),
        isActive: true,
    });

    if (!discount) throw new ApiError(404, "Invalid or inactive coupon code.");
    if (discount.timesUsed >= discount.maxUses) throw new ApiError(400, "This coupon has reached its usage limit.");
    if (cartSubtotal < discount.minCartValue) throw new ApiError(400, `A minimum cart value of ${discount.minCartValue} is required to use this coupon.`);
    
    if (discount.startDate && discount.startDate > now) throw new ApiError(400, "This coupon is not yet active.");
    if (discount.endDate && discount.endDate < now) throw new ApiError(400, "This coupon has expired.");

    if (userId) {
        const userUsage = discount.usedBy.find(u => u.user.toString() === userId.toString());
        if (userUsage && userUsage.count >= discount.maxUsesPerUser) {
            throw new ApiError(403, "You have already used this coupon the maximum number of times allowed.");
        }
    }

    return res.status(200).json(new ApiResponse(200, discount, "Coupon is valid."));
});

const updateDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;

    // --- Input Validation ---
    if (!mongoose.isValidObjectId(discountId)) {
        throw new ApiError(400, "Invalid discount ID format.");
    }
    if (Object.keys(req.body).length === 0) {
        throw new ApiError(400, "No fields provided for update.");
    }
    // --- End Validation ---
    
    const discount = await Discount.findOneAndUpdate(
        { _id: discountId, owner: req.user._id },
        { $set: req.body }, 
        { new: true, runValidators: true }
    );

    if (!discount) {
        throw new ApiError(404, "Discount not found or you don't have permission to edit it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, discount, "Discount updated successfully."));
});

const deleteDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;

    // --- Input Validation ---
    if (!mongoose.isValidObjectId(discountId)) {
        throw new ApiError(400, "Invalid discount ID format.");
    }
    // --- End Validation ---

    const discount = await Discount.findOneAndDelete({ _id: discountId, owner: req.user._id });
    if (!discount) {
        throw new ApiError(404, "Discount not found or you don't have permission to delete it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Discount deleted successfully."));
});

export {
    createDiscount,
    getMyDiscounts,
    validateDiscount,
    updateDiscount,
    deleteDiscount
};