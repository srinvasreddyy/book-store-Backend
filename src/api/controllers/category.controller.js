import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import categoryService from "../services/category.service.js";

const createCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.createCategory(req.body, req.user, req.file);
  return res.status(201).json(
    new ApiResponse(201, category, "Category created successfully.")
  );
});

const getAllCategories = asyncHandler(async (req, res) => {
  const tree = await categoryService.getAllCategories();
  return res.status(200).json(
    new ApiResponse(200, tree, "Category tree fetched successfully.")
  );
});

// ✅ ADDED THIS FUNCTION
const getCategoryList = asyncHandler(async (req, res) => {
  const list = await categoryService.getCategoryList();
  return res.status(200).json(
    new ApiResponse(200, list, "Category list fetched successfully.")
  );
});

const getCategoryById = asyncHandler(async (req, res) => {
  const category = await categoryService.getCategoryById(req.params.categoryId);
  return res.status(200).json(
    new ApiResponse(200, category, "Category fetched successfully.")
  );
});

const updateCategory = asyncHandler(async (req, res) => {
  const category = await categoryService.updateCategory(req.params.categoryId, req.body, req.file);
  return res.status(200).json(
    new ApiResponse(200, category, "Category updated successfully.")
  );
});

const deleteCategory = asyncHandler(async (req, res) => {
  const result = await categoryService.deleteCategory(req.params.categoryId);
  return res.status(200).json(
    new ApiResponse(200, result, `Category and its descendants deleted successfully.`)
  );
});

export {
  createCategory,
  getAllCategories,
  getCategoryList, // ✅ EXPORTED HERE
  getCategoryById,
  updateCategory,
  deleteCategory,
};