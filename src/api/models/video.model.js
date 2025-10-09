import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            required: true,
        },
        videoFile: {
            type: String, // URL from Cloudinary
            required: true,
        },
        duration: {
            type: Number, // from Cloudinary
            required: true,
        },
        book: {
            type: Schema.Types.ObjectId,
            ref: "Book",
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);