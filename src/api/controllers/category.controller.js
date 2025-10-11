import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

const createCategory = asyncHandler(async (req, res) => {
    const { name, description, parentCategory } = req.body;
    const adminId = req.user._id;

    if (!name) {
        throw new ApiError(400, "Category name is required");
    }

    const existingCategory = await Category.findOne({ name, owner: adminId });
    if (existingCategory) {
        throw new ApiError(409, "You already have a category with this name.");
    }

    const category = await Category.create({
        name,
        description,
        parentCategory: parentCategory || null,
        owner: adminId, // Assign ownership to the admin
    });

    return res
        .status(201)
        .json(new ApiResponse(201, category, "Category created successfully"));
});

const getAllCategories = asyncHandler(async (req, res) => {
    // This public route now only returns global categories
    const categories = await Category.find({ owner: null }).populate("parentCategory", "name");
    
    return res
        .status(200)
        .json(new ApiResponse(200, categories, "Global categories fetched successfully"));
});

const getSelectableCategories = asyncHandler(async (req, res) => {
    // This admin route returns global categories + the admin's own categories
    const adminId = req.user._id;

    const categories = await Category.find({
        $or: [
            { owner: null },
            { owner: adminId }
        ]
    }).sort({ owner: 1, name: 1 }); // Sort to group global and custom categories

    return res
        .status(200)
        .json(new ApiResponse(200, categories, "Selectable categories fetched successfully"));
});

const getAdminCategoriesWithBooks = asyncHandler(async (req, res) => {
    const adminId = req.user._id;

    // 1. Find all categories owned by the admin
    const adminCategories = await Category.find({ owner: adminId }).lean();

    // 2. For each category, find the books published by this admin under that category
    const categoriesWithBooks = await Promise.all(adminCategories.map(async (category) => {
        const books = await Book.find({
            uploadedBy: adminId,
            category: category._id
        }).select('title author price stock');
        
        return {
            ...category,
            books: books
        };
    }));

    return res
        .status(200)
        .json(new ApiResponse(200, categoriesWithBooks, "Admin categories and books fetched successfully"));
});


const updateCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const { name, description, parentCategory } = req.body;
    const adminId = req.user._id;

    if (!name) {
        throw new ApiError(400, "Category name is required");
    }

    const category = await Category.findOneAndUpdate(
        { _id: categoryId, owner: adminId }, // Ensure admin owns the category
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
        throw new ApiError(404, "Category not found or you do not have permission to edit it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, category, "Category updated successfully"));
});

const deleteCategory = asyncHandler(async (req, res) => {
    const { categoryId } = req.params;
    const adminId = req.user._id;
    
    // Ensure no books are using this category before deleting
    const bookCount = await Book.countDocuments({ category: categoryId, uploadedBy: adminId });
    if (bookCount > 0) {
        throw new ApiError(400, "Cannot delete category as it is still in use by one or more of your books.");
    }

    const result = await Category.findOneAndDelete({ _id: categoryId, owner: adminId });

    if (!result) {
        throw new ApiError(404, "Category not found or you do not have permission to delete it.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Category deleted successfully"));
});


export {
    createCategory,
    getAllCategories,
    getSelectableCategories,
    getAdminCategoriesWithBooks,
    updateCategory,
    deleteCategory
};