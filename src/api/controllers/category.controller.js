import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";

const createCategory = asyncHandler(async (req, res) => {
    const { name, description, parentCategory } = req.body;

    if (!name) {
        throw new ApiError(400, "Category name is required");
    }

    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
        throw new ApiError(409, "Category with this name already exists");
    }

    if (parentCategory) {
        const parent = await Category.findById(parentCategory);
        if (!parent) {
            throw new ApiError(404, "Parent category not found");
        }
    }

    const category = await Category.create({
        name,
        description,
        parentCategory: parentCategory || null,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, category, "Category created successfully"));
});

const getAllCategories = asyncHandler(async (req, res) => {
    // For simplicity, returning a flat list. A recursive approach could be used to build a tree.
    const categories = await Category.find({}).populate("parentCategory", "name");
    
    return res
        .status(200)
        .json(new ApiResponse(200, categories, "Categories fetched successfully"));
});

const updateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { name, description, parentCategory } = req.body;

    if (!name) {
        throw new ApiError(400, "Category name is required");
    }

    const category = await Category.findByIdAndUpdate(
        categoryId,
        {
            $set: {
                name,
                description,
                parentCategory: parentCategory || null,
            },
        },
        { new: true }
    );

    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, category, "Category updated successfully"));
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;

    // Note: This does not handle cascading deletes for subcategories or associated books.
    // This would need to be addressed in a more robust implementation.
    const result = await Category.findByIdAndDelete(categoryId);

    if (!result) {
        throw new ApiError(404, "Category not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Category deleted successfully"));
});


export {
    createCategory,
    getAllCategories,
    updateCategory,
    deleteCategory
};