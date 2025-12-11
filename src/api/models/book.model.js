import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        author: {
            type: String,
            required: true,
            trim: true,
        },
        isbn: {
            type: String,
            trim: true
            // Optional
        },
        publisher: {
            type: String,
            trim: true,
            // Optional
        },
        numberOfPages: {
            type: Number,
            // Optional
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            // Optional
        },
        format: {
            type: String,
            enum: ['Hardcover', 'Paperback'],
            // Optional - if not provided, it's undefined, which passes validation
        },
        language: {
            type: String,
            trim: true,
            // Optional
        },
        shortDescription: {
            type: String,
            // Optional
        },
        fullDescription: {
            type: String,
            trim: true,
            // Optional
        },
        tags: [{
            type: Schema.Types.ObjectId,
            ref: "Tag",
        }],
        price: {
            type: Number,
            required: true, // Regular Price (Required)
            min: 0,
        },
        salePrice: {
            type: Number,
            required: true, // Sale Price (Required)
            min: 0,
        },
        deliveryCharge: {
            type: Number,
            required: true, // Delivery Fee (Required)
            min: 0,
        },
        stock: {
            type: Number,
            // Optional
        },
        coverImages: {
            type: [String],
            default: [],
            validate: [
                (val) => val.length <= 10,
                'A book can have at most 10 cover images.'
            ]
        },
        samplePdfUrl: {
            type: String,
            default: null,
        },
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true, // Required for system tracking
        },
        isFeatured: {
            type: Boolean,
            default: false,
        },
        isBestSeller: {
            type: Boolean,
            default: false,
        },
        oldBook: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true,
    }
);

// Explicitly define index with a dummy override so it ignores your 'language' field
bookSchema.index(
    { title: "text", author: "text" }, 
    { language_override: "dummy_language_field" }
);

bookSchema.plugin(mongooseAggregatePaginate);

export const Book = mongoose.model("Book", bookSchema);