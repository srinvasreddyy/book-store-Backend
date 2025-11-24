import mongoose, { Schema } from "mongoose";

const freeContentSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        pdfUrl: {
            type: String,
            required: true
        },
        coverImage: {
            type: String, 
            // If not provided, frontend/backend logic can derive thumb from PDF url
            default: null 
        }
    },
    { timestamps: true }
);

export const FreeContent = mongoose.model("FreeContent", freeContentSchema);