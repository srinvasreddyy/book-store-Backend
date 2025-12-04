import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const bookSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            // index: "text", <--- REMOVED (Defined at bottom)
        },
        author: {
            type: String,
            required: true,
            trim: true,
            // index: "text", <--- REMOVED (Defined at bottom)
        },
        isbn: {
            type: String,
            required: false,
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
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        // subCategory field is removed as per new architecture
        format: {
            type: String,
            required: true,
            enum: ['Hardcover', 'Paperback'],
        },
        language: {
            type: String,
            required: true,
            trim: true,
        },
        shortDescription: {
            type: String,
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
        salePrice: {
            type: Number,
            default: 0,
            min: 0,
        },
        deliveryCharge: {
            type: Number,
            required: true,
            min: 0,
        },
        stock: {
            type: Number,
            required: true,
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
            required: true,
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

// ✅ FIX: Explicitly define index with a dummy override so it ignores your 'language' field
bookSchema.index(
    { title: "text", author: "text" }, 
    { language_override: "dummy_language_field" }
);

bookSchema.plugin(mongooseAggregatePaginate);

export const Book = mongoose.model("Book", bookSchema);