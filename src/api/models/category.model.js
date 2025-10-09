import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        description: {
            type: String,
            trim: true,
        },
        parentCategory: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

export const Category = mongoose.model("Category", categorySchema);