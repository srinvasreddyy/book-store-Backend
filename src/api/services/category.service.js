import { Category } from "../models/category.model.js";
import { Book } from "../models/book.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import { ApiError } from "../../utils/ApiError.js";
import mongoose from "mongoose";

// Helper to build a nested tree structure
const buildCategoryTree = (categories, parentId = null) => {
  const categoryList = [];
  let category;
  if(parentId == null) {
      category = categories.filter(cat => cat.parent == undefined);
  } else {
      category = categories.filter(cat => String(cat.parent) == String(parentId));
  }

  for(let cat of category) {
      categoryList.push({
          _id: cat._id,
          name: cat.name,
          description: cat.description,
          backgroundImage: cat.backgroundImage,
          level: cat.level,
          isPinned: cat.isPinned || false, 
          children: buildCategoryTree(categories, cat._id)
      });
  }
  return categoryList;
};

// Recursive function to get all descendant IDs
const getDescendantIds = async (categoryId) => {
  const children = await Category.find({ parent: categoryId });
  let ids = children.map(c => c._id);
  for (const child of children) {
    const subIds = await getDescendantIds(child._id);
    ids = ids.concat(subIds);
  }
  return ids;
};

const createCategory = async (categoryData, user, file) => {
  const { name, description, isPinned } = categoryData;
  let { parentId } = categoryData;
  const adminId = user?._id;

  // Fix: Handle string "null"/"undefined" from FormData
  if (parentId === "null" || parentId === "undefined" || parentId === "") {
    parentId = null;
  }

  if (!name || name.trim() === "") {
    throw new ApiError(400, "Category name is required.");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let level = 1;
    let parentCategory = null;

    if (parentId && mongoose.isValidObjectId(parentId)) {
      parentCategory = await Category.findById(parentId).session(session);
      if (!parentCategory) {
        throw new ApiError(404, "Parent category not found.");
      }
      
      if (parentCategory.level >= 4) {
        throw new ApiError(400, "Maximum category depth (4 levels) reached.");
      }
      level = parentCategory.level + 1;
    }

    // Validation: Only Root Categories (Level 1) can be pinned
    let finalIsPinned = false;
    if (String(isPinned) === "true" || isPinned === true) {
      if (level !== 1) {
        throw new ApiError(400, "Only root categories can be pinned.");
      }
      finalIsPinned = true;
    }

    // Image Upload
    let imageUrl = null;
    if (file) {
      const image = await uploadOnCloudinary(file.path);
      if (image?.url) imageUrl = image.url;
    }

    // Create Category with Duplicate Check
    try {
        const newCategory = await Category.create([{
          name,
          description,
          backgroundImage: imageUrl,
          parent: parentId || null,
          level,
          isPinned: finalIsPinned,
          owner: adminId,
          children: []
        }], { session });

        const createdCat = newCategory[0];

        if (parentCategory) {
          parentCategory.children.push(createdCat._id);
          await parentCategory.save({ session });
        }

        await session.commitTransaction();
        return createdCat;

    } catch (innerError) {
        // Handle Duplicate Key Error (E11000)
        if (innerError.code === 11000) {
            throw new ApiError(409, "A category with this name already exists at this level.");
        }
        throw innerError;
    }

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAllCategories = async () => {
  const categories = await Category.find({}).lean(); 
  return buildCategoryTree(categories);
};

const getCategoryList = async () => {
  return await Category.find({}).select("name _id level parent isPinned");
};

const getCategoryById = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) throw new ApiError(400, "Invalid ID.");
  const category = await Category.findById(categoryId).populate("children");
  if (!category) throw new ApiError(404, "Category not found.");
  return category;
};

const updateCategory = async (categoryId, updateData, file) => {
  if (!mongoose.isValidObjectId(categoryId)) throw new ApiError(400, "Invalid ID.");

  const category = await Category.findById(categoryId);
  if (!category) throw new ApiError(404, "Category not found.");

  if (updateData.name) category.name = updateData.name;
  if (updateData.description !== undefined) category.description = updateData.description;

  // Pinning Logic
  if (updateData.isPinned !== undefined) {
    const shouldPin = String(updateData.isPinned) === "true" || updateData.isPinned === true;
    const isRoot = !category.parent; 

    if (shouldPin && !isRoot) {
       throw new ApiError(400, "Only root categories can be pinned.");
    }
    category.isPinned = shouldPin;
  }

  if (file) {
    const oldImageUrl = category.backgroundImage;
    const image = await uploadOnCloudinary(file.path);
    if (image?.url) {
      category.backgroundImage = image.url;
      if (oldImageUrl) deleteFromCloudinary(oldImageUrl).catch(() => {});
    }
  }

  try {
      return await category.save();
  } catch (error) {
      if (error.code === 11000) {
          throw new ApiError(409, "A category with this name already exists.");
      }
      throw error;
  }
};

const deleteCategory = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) throw new ApiError(400, "Invalid ID.");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const category = await Category.findById(categoryId).session(session);
    if (!category) throw new ApiError(404, "Category not found.");

    const descendantIds = await getDescendantIds(categoryId);
    const allIdsToDelete = [categoryId, ...descendantIds];

    const booksUsingCategories = await Book.countDocuments({ 
      category: { $in: allIdsToDelete } 
    }).session(session);

    if (booksUsingCategories > 0) {
      throw new ApiError(400, `Cannot delete: ${booksUsingCategories} books are attached to this category or its subcategories.`);
    }

    if (category.parent) {
      await Category.findByIdAndUpdate(
        category.parent,
        { $pull: { children: categoryId } },
        { session }
      );
    }

    await Category.deleteMany({ _id: { $in: allIdsToDelete } }).session(session);

    await session.commitTransaction();

    if (category.backgroundImage) {
      deleteFromCloudinary(category.backgroundImage).catch(() => {});
    }

    return { deletedCount: allIdsToDelete.length };

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

export default {
  createCategory,
  getAllCategories,
  getCategoryList,
  getCategoryById,
  updateCategory,
  deleteCategory
};