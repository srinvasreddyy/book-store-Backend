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
            trim: true,
            validate: {
                validator: function (v) {
                    // ISBN-10 or ISBN-13
                    return /^(?=(?:\D*\d){10}(?:(?:\D*\d){3})?$)[\d-]+$/.test(v);
                },
                message: props => `${props.value} is not a valid ISBN!`
            },
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
            enum: ['eBook', 'Hardcover', 'Paperback', 'Audiobook'],
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
        uploadedBy: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

bookSchema.plugin(mongooseAggregatePaginate);

export const Book = mongoose.model("Book", bookSchema);