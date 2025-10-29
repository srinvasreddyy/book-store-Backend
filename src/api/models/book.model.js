import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            index: "text",
        },
        author: {
            type: String,
            required: true,
            trim: true,
            index: "text",
        },
        isbn: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        publisher: {
            type: String,
            required: true,
            trim: true,
        },
        numberOfPages: {
            type: Number,
            required: true,
            min: 1,
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        format: {
            type: String,
            required: true,
            enum: ['Hardcover', 'Paperback'], // Restricted to physical formats
        },
        language: {
            type: String,
            required: true,
            trim: true,
        },
        shortDescription: {
            type: String,
            required: true,
            trim: true,
            maxlength: 250,
        },
        fullDescription: {
            type: String,
            required: true,
            trim: true,
        },
        tags: [{
            type: Schema.Types.ObjectId,
            ref: "Tag",
        }],
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
        coverImages: {
            type: [String], // Array of URLs from Cloudinary
            required: true,
            validate: [
                (val) => val.length > 0 && val.length <= 5,
                'A book must have between 1 and 5 cover images.'
            ]
        },
        samplePdfUrl: {
            type: String, // URL for sample PDF from Cloudinary
            default: null,
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isBestSeller: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

bookSchema.plugin(mongooseAggregatePaginate);

export const Book = mongoose.model("Book", bookSchema);
