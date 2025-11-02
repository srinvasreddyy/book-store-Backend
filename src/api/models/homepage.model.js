import mongoose, { Schema } from "mongoose";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const urlRegex = /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i;

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
      validator: (v) => /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(v),
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

const footerContentSchema = new Schema({
  email: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => v === "" || v === null || emailRegex.test(v),
      message: (props) => `${props.value} is not a valid email address!`,
    },
  },
  phoneNumber: {
    type: String,
    trim: true,
  },
  facebookUrl: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => v === "" || v === null || urlRegex.test(v),
      message: (props) => `${props.value} is not a valid URL!`,
    },
  },
  instagramUrl: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => v === "" || v === null || urlRegex.test(v),
      message: (props) => `${props.value} is not a valid URL!`,
    },
  },
  linkedInUrl: {
    type: String,
    trim: true,
    validate: {
      validator: (v) => v === "" || v === null || urlRegex.test(v),
      message: (props) => `${props.value} is not a valid URL!`,
    },
  },
}, { _id: false }); // No _id for this sub-document


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
    footerContent: {
      type: footerContentSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

export const Homepage = mongoose.model("Homepage", homepageSchema);