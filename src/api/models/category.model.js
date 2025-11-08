import mongoose, { Schema } from "mongoose";

const categorySchema = new Schema(
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
    owner: {
      // null for global, admin's _id for custom
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    isDefault: {
      type: Boolean,
      default: false,
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

// A category name must be unique for its owner.
// A global category (owner: null) 'Fiction' can exist,
// and an admin-owned category 'Fiction' can also exist.
categorySchema.index({ name: 1, owner: 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);