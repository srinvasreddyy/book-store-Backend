import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { SubCategory } from "../models/subCategory.model.js";
import { Category } from "../models/category.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

const createSubCategory = asyncHandler(async (req, res) => {
  const { name, description, parentCategory } = req.body;
  const adminId = req.user._id;

  if (!name || name.trim() === "") throw new ApiError(400, "Name is required.");
  if (!mongoose.isValidObjectId(parentCategory)) throw new ApiError(400, "Invalid parent category ID.");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const parent = await Category.findById(parentCategory).session(session);
    if (!parent) throw new ApiError(404, "Parent category not found.");

    // Check for duplicate name under the SAME parent
    const existing = await SubCategory.findOne({ name, parentCategory }).session(session);
    if (existing) throw new ApiError(409, "Subcategory with this name already exists in this category.");

    const subCategory = await SubCategory.create([{
      name,
      description,
      parentCategory,
      owner: adminId
    }], { session });

    // Bidirectional update: push new sub ID to parent's array
    parent.subCategories.push(subCategory[0]._id);
    await parent.save({ session });

    await session.commitTransaction();
    return res.status(201).json(new ApiResponse(201, subCategory[0], "Subcategory created."));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

const getAllSubCategories = asyncHandler(async (req, res) => {
  const subCategories = await SubCategory.find({}).populate("parentCategory", "name");
  return res.status(200).json(new ApiResponse(200, subCategories, "fetched successfully"));
});

const updateSubCategory = asyncHandler(async (req, res) => {
  const { subCategoryId } = req.params;
  const { name, description } = req.body;

  if (!mongoose.isValidObjectId(subCategoryId)) throw new ApiError(400, "Invalid ID.");

  const subCategory = await SubCategory.findByIdAndUpdate(
    subCategoryId,
    { $set: { name, description } },
    { new: true, runValidators: true }
  );

  if (!subCategory) throw new ApiError(404, "Subcategory not found.");

  return res.status(200).json(new ApiResponse(200, subCategory, "Updated successfully."));
});

const deleteSubCategory = asyncHandler(async (req, res) => {
  const { subCategoryId } = req.params;
  if (!mongoose.isValidObjectId(subCategoryId)) throw new ApiError(400, "Invalid ID.");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Check if any books use this subcategory
    const inUse = await Book.exists({ subCategory: subCategoryId }).session(session);
    if (inUse) throw new ApiError(400, "Cannot delete: Subcategory is in use by books.");

    const subCategory = await SubCategory.findByIdAndDelete(subCategoryId).session(session);
    if (!subCategory) throw new ApiError(404, "Subcategory not found.");

    // Bidirectional update: pull ID from parent's array
    await Category.findByIdAndUpdate(
      subCategory.parentCategory,
      { $pull: { subCategories: subCategoryId } },
      { session }
    );

    await session.commitTransaction();
    return res.status(200).json(new ApiResponse(200, {}, "Deleted successfully."));
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
});

export { createSubCategory, getAllSubCategories, updateSubCategory, deleteSubCategory };