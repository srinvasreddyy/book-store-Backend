import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const orderedItemSchema = new Schema({
    book: { type: Schema.Types.ObjectId, ref: "Book" },
    quantity: { type: Number, required: true },
    priceAtPurchase: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
});

const orderSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        items: [orderedItemSchema],
        status: {
            type: String,
            enum: ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'],
            default: 'PENDING',
        },
        // --- Pricing Breakdown ---
        subtotal: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        handlingFee: { type: Number, required: true },
        deliveryFee: { type: Number, required: true },
        finalAmount: { type: Number, required: true },

        appliedDiscount: { type: Schema.Types.ObjectId, ref: "Discount" },

        // --- Payment Details ---
        paymentMethod: {
            type: String,
            enum: ['CARD', 'UPI', 'RAZORPAY', 'CASH_ON_DELIVERY'],
            required: true,
        },
        paymentStatus: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'FAILED'],
            default: 'PENDING',
        },
        razorpayOrderId: { type: String },
        razorpayPaymentId: { type: String },
        razorpaySignature: { type: String },
        idempotencyKey: { type: String, unique: true, sparse: true },
    },
    {
        timestamps: true,
    }
);

orderSchema.plugin(mongooseAggregatePaginate);

export const Order = mongoose.model("Order", orderSchema);