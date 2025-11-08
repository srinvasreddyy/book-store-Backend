import mongoose, { Schema } from "mongoose";

const subCategorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        backgroundImage: {
            type: String, // Cloudinary URL
            default: null,
        },
        parentCategory:
        {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
    },
    {
        timestamps: true,
    },
);

export const Category = mongoose.model("Category", subCategorySchema);