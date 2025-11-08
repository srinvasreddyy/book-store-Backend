import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    backgroundImage: {
      type: String, // Cloudinary URL
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null, // Null means global category
    },
    subCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],
  },
  {
    timestamps: true,
  },
);

export const Category = mongoose.model("Category", categorySchema);