import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Category } from "../models/category.model.js";
import { Book } from "../models/book.model.js";
import mongoose from "mongoose";

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
        .json(new ApiResponse(200, topCategories, "Top categories fetched successfully."));
});


const getSelectableCategories = asyncHandler(async (req, res) => {
  // This admin route returns global categories + the admin's own categories
  const adminId = req.user._id;

  const categories = await Category.find({
    $or: [{ owner: null }, { owner: adminId }],
  }).sort({ owner: 1, name: 1 }); // Sort to group global and custom categories

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        categories,
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
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, owner: adminId },
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

  const bookCount = await Book.countDocuments({
    category: categoryId,
    uploadedBy: adminId,
  });
  if (bookCount > 0) {
    throw new ApiError(
      400,
      `Cannot delete category. It is currently used by ${bookCount} of your book(s).`,
    );
  }

  const result = await Category.findOneAndDelete({
    _id: categoryId,
    owner: adminId,
  });

  if (!result) {
    throw new ApiError(
      404,
      "Category not found or you do not have permission to delete it.",
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