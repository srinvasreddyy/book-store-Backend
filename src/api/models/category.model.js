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
    // Self-referencing field for the parent
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null, 
    },
    // Array of children for easier tree traversal
    children: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    // To enforce the 4-level limit (Root is 1)
    level: {
      type: Number,
      default: 1,
      min: 1,
      max: 4 
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure names are unique amongst siblings (same parent)
categorySchema.index({ name: 1, parent: 1 }, { unique: true });

export const Category = mongoose.model("Category", categorySchema);