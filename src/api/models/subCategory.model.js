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
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate subcategory names within the same parent category
subCategorySchema.index({ name: 1, parentCategory: 1 }, { unique: true });

export const SubCategory = mongoose.model("SubCategory", subCategorySchema);