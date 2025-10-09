import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const orderedItemSchema = new Schema({
    book: {
        type: Schema.Types.ObjectId,
        ref: "Book"
    },
    quantity: {
        type: Number,
        required: true,
    },
    priceAtPurchase: {
        type: Number,
        required: true,
    },
});

const orderSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        items: [orderedItemSchema],
        status: {
            type: String,
            enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
            default: 'PENDING',
        },
        subtotal: {
            type: Number,
            required: true,
        },
        appliedDiscount: {
            type: Schema.Types.ObjectId,
            ref: "Discount",
        },
        totalAmount: {
            type: Number,
            required: true,
        },
        // In a real app, you would have shippingAddress, paymentDetails, etc.
    },
    {
        timestamps: true,
    }
);

orderSchema.plugin(mongooseAggregatePaginate);

export const Order = mongoose.model("Order", orderSchema);