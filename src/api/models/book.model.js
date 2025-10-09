import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        description: {
            type: String,
            required: true,
        },
        author: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        isbn: {
            type: String,
            unique: true,
            trim: true,
        },
        publisher: {
            type: String,
        },
        coverImage: {
            type: String, // URL from Cloudinary
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

bookSchema.plugin(mongooseAggregatePaginate);

export const Book = mongoose.model("Book", bookSchema);