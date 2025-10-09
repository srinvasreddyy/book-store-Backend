import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Discount } from "../models/discount.model.js";

const createDiscount = asyncHandler(async (req, res) => {
    const { couponCode, description, type, value, startDate, endDate, applicableTo, applicableCategory } = req.body;

    if (!couponCode || !description || !type || !value) {
        throw new ApiError(400, "Coupon code, description, type, and value are required");
    }

    const existingDiscount = await Discount.findOne({ couponCode });
    if (existingDiscount) {
        throw new ApiError(409, "A discount with this coupon code already exists");
    }

    const discount = await Discount.create({
        couponCode,
        description,
        type,
        value,
        startDate,
        endDate,
        applicableTo,
        applicableCategory: applicableTo === 'CATEGORY' ? applicableCategory : null,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, discount, "Discount created successfully"));
});

const getAllDiscounts = asyncHandler(async (req, res) => {
    const discounts = await Discount.find({}).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, discounts, "All discounts fetched successfully"));
});

const getDiscountByCode = asyncHandler(async (req, res) => {
    const { couponCode } = req.params;
    const now = new Date();

    const discount = await Discount.findOne({
        couponCode: couponCode.toUpperCase(),
        isActive: true,
        $and: [
            { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
            { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
        ],
    });

    if (!discount) {
        throw new ApiError(404, "Invalid or expired coupon code");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, discount, "Coupon is valid"));
});

const updateDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;
    const updateData = req.body;

    const discount = await Discount.findByIdAndUpdate(discountId, { $set: updateData }, { new: true });

    if (!discount) {
        throw new ApiError(404, "Discount not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, discount, "Discount updated successfully"));
});

const deleteDiscount = asyncHandler(async (req, res) => {
    const { discountId } = req.params;

    const discount = await Discount.findByIdAndDelete(discountId);

    if (!discount) {
        throw new ApiError(404, "Discount not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Discount deleted successfully"));
});

export {
    createDiscount,
    getAllDiscounts,
    getDiscountByCode,
    updateDiscount,
    deleteDiscount
};
