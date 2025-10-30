import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

// --- Feature Flag Check ---
// Per user request, this feature defaults to TRUE.
const HIERARCHICAL_CATEGORIES_ENABLED =
  process.env.ENABLE_HIERARCHICAL_CATEGORIES === "false" ? false : true;

/**
 * Helper function to build a nested category tree from a flat list.
 * @param {Array} categories - The flat list of category documents.
 * @param {null|mongoose.Types.ObjectId} parentId - The ID of the parent to start from (null for root).
 * @returns {Array} - A nested array of category objects.
 */
const buildCategoryTree = (categories, parentId = null) => {
  const tree = [];
  // Find all categories whose parent matches the current parentId
  const children = categories.filter((category) => {
    // Handle both null/undefined and ObjectId matching
    if (parentId === null) {
      return !category.parentCategory;
    }
    // Check if category.parentCategory exists and matches the parentId
    return (
      category.parentCategory &&
      category.parentCategory.toString() === parentId.toString()
    );
  });

  // Sort children alphabetically by name
  children.sort((a, b) => a.name.localeCompare(b.name));

  for (const child of children) {
    // For each child, recursively find its own children
    const grandChildren = buildCategoryTree(categories, child._id);
    tree.push({
      _id: child._id,
      name: child.name,
      description: child.description,
      owner: child.owner,
      parentCategory: child.parentCategory,
      isDefault: child.isDefault,
      createdAt: child.createdAt,
      updatedAt: child.updatedAt,
      children: grandChildren,
    });
  }
  return tree;
};

const createCategory = asyncHandler(async (req, res) => {
  const { name, description, parentCategory } = req.body;
  const adminId = req.user._id;

  // --- Input Validation ---
  if (!name || name.trim() === "") {
    throw new ApiError(400, "Category name is required.");
  }

  if (parentCategory && !mongoose.isValidObjectId(parentCategory)) {
    throw new ApiError(400, "Invalid parent category ID format.");
  }
  // --- End Validation ---

  const existingCategory = await Category.findOne({ name, owner: adminId });
  if (existingCategory) {
    throw new ApiError(409, "You already have a category with this name.");
  }

  if (parentCategory) {
    const parentExists = await Category.findById(parentCategory);
    if (!parentExists) {
      throw new ApiError(404, "The specified parent category does not exist.");
    }
    // Check if the parent is one of the admin's own or a global one
    if (
      parentExists.owner !== null &&
      parentExists.owner.toString() !== adminId.toString()
    ) {
      throw new ApiError(
        403,
        "You can only create sub-categories under your own categories or global categories.",
      );
    }
  }

  const category = await Category.create({
    name,
    description,
    parentCategory: parentCategory || null,
    owner: adminId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, category, "Category created successfully."));
});

const getGlobalCategories = asyncHandler(async (req, res) => {
  // This public route now only returns global categories
  const categories = await Category.find({ owner: null }).populate(
    "parentCategory",
    "name",
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categories,
        "Global categories fetched successfully.",
      ),
    );
});

// New function for FEATURE-021
const getAllCategories = asyncHandler(async (req, res) => {
  // This public route returns all categories, global and admin-created
  const categories = await Category.find({}).populate("parentCategory", "name");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categories,
        "All categories fetched successfully.",
      ),
    );
});

// New function for FEATURE-020
const getTopCategories = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 5;

  if (limit <= 0) {
    throw new ApiError(400, "Limit must be a positive number.");
  }

  const topCategories = await Book.aggregate([
    {
      $group: {
        _id: "$category",
        bookCount: { $sum: 1 },
      },
    },
    {
      $sort: { bookCount: -1 },
    },
    {
      $limit: limit,
    },
    {
      $lookup: {
        from: "categories",
        localField: "_id",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    {
      $unwind: "$categoryDetails",
    },
    {
      $project: {
        _id: "$categoryDetails._id",
        name: "$categoryDetails.name",
        description: "$categoryDetails.description",
        bookCount: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, topCategories, "Top categories fetched successfully."),
    );
});

const getSelectableCategories = asyncHandler(async (req, res) => {
  // This admin route returns global categories + the admin's own categories
  const adminId = req.user._id;

  const selectableCategories = await Category.find({
    $or: [{ owner: null }, { owner: adminId }],
  }).lean(); // Use .lean() for faster in-memory processing

  let responseData;

  // --- FEATURE-020: Hierarchical Categories ---
  if (HIERARCHICAL_CATEGORIES_ENABLED) {
    // Build a tree structure from the flat list
    responseData = buildCategoryTree(selectableCategories, null);
  } else {
    // Return the original flat list
    responseData = selectableCategories;
  }
  // --- End FEATURE-020 ---

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        responseData,
        "Selectable categories fetched successfully.",
      ),
    );
});

const getAdminCategoriesWithBooks = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

  const adminCategories = await Category.find({ owner: adminId }).lean();

  const categoriesWithBooks = await Promise.all(
    adminCategories.map(async (category) => {
      const books = await Book.find({
        uploadedBy: adminId,
        category: category._id,
      }).select("title author price stock");

      return {
        ...category,
        books: books,
      };
    }),
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categoriesWithBooks,
        "Admin categories and books fetched successfully.",
      ),
    );
});

const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const { name, description, parentCategory } = req.body;
  const adminId = req.user._id;

  // --- Input Validation ---
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, "Invalid category ID format.");
  }
  if (!name || name.trim() === "") {
    throw new ApiError(400, "Category name is required.");
  }
  if (parentCategory && !mongoose.isValidObjectId(parentCategory)) {
    throw new ApiError(400, "Invalid parent category ID format.");
  }
  if (parentCategory && parentCategory === categoryId) {
    throw new ApiError(400, "A category cannot be its own parent.");
  }
  // --- End Validation ---

  if (parentCategory) {
    const parentExists = await Category.findById(parentCategory);
    if (!parentExists) {
      throw new ApiError(404, "The specified parent category does not exist.");
    }
    // Check if the new parent is one of the admin's own or a global one
    if (
      parentExists.owner !== null &&
      parentExists.owner.toString() !== adminId.toString()
    ) {
      throw new ApiError(
        403,
        "You can only nest under your own categories or global categories.",
      );
    }
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, owner: adminId }, // Can only update their own categories
    {
      $set: {
        name,
        description,
        parentCategory: parentCategory || null,
      },
    },
    { new: true, runValidators: true },
  );

  if (!category) {
    throw new ApiError(
      404,
      "Category not found or you do not have permission to edit it.",
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, category, "Category updated successfully."));
});

const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;
  const adminId = req.user._id;

  // --- Input Validation ---
  if (!mongoose.isValidObjectId(categoryId)) {
    throw new ApiError(400, "Invalid category ID format.");
  }
  // --- End Validation ---

  // --- FEATURE-020: Check for sub-categories ---
  const childCategoryCount = await Category.countDocuments({
    parentCategory: categoryId,
  });
  if (childCategoryCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category. It has ${childCategoryCount} sub-categor(y)ies. Please delete or re-assign them first.`,
    );
  }
  // --- End FEATURE-020 ---

  const bookCount = await Book.countDocuments({
    category: categoryId,
    uploadedBy: adminId, // Only check for books owned by this admin
  });
  if (bookCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category. It is currently used by ${bookCount} of your book(s).`,
    );
  }

  const result = await Category.findOneAndDelete({
    _id: categoryId,
    owner: adminId, // Can only delete their own categories
  });

  if (!result) {
    throw new ApiError(
      404,
      "Category not found or you do not have permission to delete it (e.g., global categories cannot be deleted).",
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Category deleted successfully."));
});

export {
  createCategory,
  getGlobalCategories,
  getAllCategories,
  getTopCategories,
  getSelectableCategories,
  getAdminCategoriesWithBooks,
  updateCategory,
  deleteCategory,
};