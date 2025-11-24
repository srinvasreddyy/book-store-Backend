import mongoose, { Schema } from "mongoose";

const clientSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        url: {
            type: String,
            trim: true,
            default: ''
        },
        logo: {
            type: String, // Cloudinary URL
            required: true
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export const Client = mongoose.model("Client", clientSchema);