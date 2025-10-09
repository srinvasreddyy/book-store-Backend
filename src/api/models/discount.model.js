import mongoose, { Schema } from "mongoose";

const discountSchema = new Schema(
    {
        couponCode: {
            type: String,
            required: true,
            unique: true,
            uppercase: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
            required: true,
        },
        value: {
            type: Number,
            required: true,
            min: 0,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
        startDate: {
            type: Date,
            default: null,
        },
        endDate: {
            type: Date,
            default: null,
        },
        applicableTo: {
            type: String,
            enum: ['ALL_PRODUCTS', 'CATEGORY'],
            default: 'ALL_PRODUCTS',
        },
        applicableCategory: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
    },
    {
        timestamps: true,
    }
);

export const Discount = mongoose.model("Discount", discountSchema);