import mongoose, { Schema } from "mongoose";

const specialSchema = new Schema(
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
        images: {
            type: [String],
            validate: [
                (val) => val.length <= 30,
                'Specials can have at most 30 images.'
            ],
            default: []
        },
        // We can optionally store a specific cover image selection, 
        // or just use the first image in the array as cover.
        // For simplicity based on your requirements, we'll rely on the images array.
    },
    { timestamps: true }
);

export const Special = mongoose.model("Special", specialSchema);