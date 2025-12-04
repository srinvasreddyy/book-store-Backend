import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import categoryService from "../services/category.service.js";

const createCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.createCategory(req.body, req.file, req.user);
    return res.status(201).json(new ApiResponse(201, category, "Category created successfully"));
});

const getAllCategories = asyncHandler(async (req, res) => {
    const categories = await categoryService.getAllCategories();
    return res.status(200).json(new ApiResponse(200, categories, "Categories fetched successfully"));
});

const getCategoryById = asyncHandler(async (req, res) => {
    const category = await categoryService.getCategoryById(req.params.categoryId);
    return res.status(200).json(new ApiResponse(200, category, "Category fetched successfully"));
});

const updateCategory = asyncHandler(async (req, res) => {
    const category = await categoryService.updateCategory(req.params.categoryId, req.body, req.file);
    return res.status(200).json(new ApiResponse(200, category, "Category updated successfully"));
});

const deleteCategory = asyncHandler(async (req, res) => {
    await categoryService.deleteCategory(req.params.categoryId);
    return res.status(200).json(new ApiResponse(200, {}, "Category deleted successfully"));
});

const toggleCategoryPin = asyncHandler(async (req, res) => {
    const category = await categoryService.togglePin(req.params.categoryId);
    const message = category.isPinned ? "Category pinned successfully" : "Category unpinned successfully";
    return res.status(200).json(new ApiResponse(200, category, message));
});

export {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    toggleCategoryPin
};