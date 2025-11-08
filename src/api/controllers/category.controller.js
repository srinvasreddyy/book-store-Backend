import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";
import { SubCategory } from "../models/subCategory.model.js";
import { Book } from "../models/book.model.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../../utils/cloudinary.js";
import mongoose from "mongoose";
import logger from "../../utils/logger.js";

const createCategory = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  const adminId = req.user._id;

  if (!name || name.trim() === "") {
    throw new ApiError(400, "Category name is required.");
  }

  let imageUrl = null;
  if (req.file) {
    const image = await uploadOnCloudinary(req.file.buffer);
    if (!image?.url) {
      throw new ApiError(500, "Failed to upload background image.");
    }
    imageUrl = image.url;
  }

  const existingCategory = await Category.findOne({ name });
  if (existingCategory) {
    throw new ApiError(409, "A category with this name already exists.");
  }

  const category = await Category.create({
    name,
    description,
    backgroundImage: imageUrl,
    owner: adminId,
    subCategories: [],
  });

  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created successfully."));
});

const getAllCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find({}).populate("subCategories", "name");
  return res
    .status(200)
    .json(new ApiResponse(200, categories, "All categories fetched successfully."));
});

const getCategoryById = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, "Invalid category ID.");
  }

  const category = await Category.findById(categoryId).populate("subCategories");
  if (!category) {
    throw new ApiError(404, "Category not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, category, "Category fetched successfully."));
});

const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { name, description } = req.body;

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, "Invalid category ID.");
  }

  const category = await Category.findById(categoryId);
  if (!category) {
    throw new ApiError(404, "Category not found.");
  }

  if (req.user.role !== "ADMIN") {
     throw new ApiError(403, "Permission denied.");
  }

  if (name) category.name = name;
  if (description !== undefined) category.description = description;

  if (req.file) {
    const oldImageUrl = category.backgroundImage;
    const image = await uploadOnCloudinary(req.file.buffer);
    if (!image?.url) {
      throw new ApiError(500, "Failed to upload new background image.");
    }
    category.backgroundImage = image.url;

    if (oldImageUrl) {
      deleteFromCloudinary(oldImageUrl).catch((err) =>
        logger.warn(`Failed to delete old image: ${err.message}`)
      );
    }
  }

  await category.save();
  return res
    .status(200)
    .json(new ApiResponse(200, category, "Category updated successfully."));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, "Invalid category ID.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const category = await Category.findById(categoryId).session(session);
    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    // Check for books using this category
    const bookCount = await Book.countDocuments({ category: categoryId }).session(session);
    if (bookCount > 0) {
      throw new ApiError(400, `Cannot delete: ${bookCount} books use this category.`);
    }

    // Delete all subcategories first
    await SubCategory.deleteMany({ parentCategory: categoryId }).session(session);

    // Delete the category
    await Category.findByIdAndDelete(categoryId).session(session);

    await session.commitTransaction();

    if (category.backgroundImage) {
       deleteFromCloudinary(category.backgroundImage).catch(() => {});
    }

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Category and its subcategories deleted."));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};