import mongoose, { Schema } from "mongoose";

const carouselImageSchema = new Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  imageUrl: { type: String, required: true }, // Cloudinary URL
  bookLink: { type: Schema.Types.ObjectId, ref: "Book", default: null },
});

const youtubeVideoSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  videoUrl: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        // Simple regex to check for a valid YouTube URL
        return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(v);
      },
      message: (props) => `${props.value} is not a valid YouTube URL!`,
    },
  },
});

const shortVideoSchema = new Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  videoUrl: { type: String, required: true }, // Cloudinary URL
  duration: { type: Number, required: true }, // In seconds
});

const homepageSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    carouselImages: [carouselImageSchema],
    youtubeVideos: [youtubeVideoSchema],
    shortVideos: [shortVideoSchema],
  },
  {
    timestamps: true,
  },
);

export const Homepage = mongoose.model("Homepage", homepageSchema);
