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
  const { name, description, parentId } = categoryData;
  const adminId = user._id;

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
      
      // 1. Enforce 4-Level Limit
      if (parentCategory.level >= 4) {
        throw new ApiError(400, "Maximum category depth (4 levels) reached.");
      }
      level = parentCategory.level + 1;
    }

    // 2. Check for Duplicates (Siblings cannot have same name)
    const existing = await Category.findOne({ 
      name, 
      parent: parentId || null 
    }).session(session);
    
    if (existing) {
      throw new ApiError(409, "A category with this name already exists at this level.");
    }

    // 3. Image Upload
    let imageUrl = null;
    if (file) {
      const image = await uploadOnCloudinary(file.path);
      if (image?.url) imageUrl = image.url;
    }

    // 4. Create Category
    const newCategory = await Category.create([{
      name,
      description,
      backgroundImage: imageUrl,
      parent: parentId || null,
      level,
      owner: adminId,
      children: []
    }], { session });

    const createdCat = newCategory[0];

    // 5. Update Parent's children array
    if (parentCategory) {
      parentCategory.children.push(createdCat._id);
      await parentCategory.save({ session });
    }

    await session.commitTransaction();
    return createdCat;

  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

const getAllCategories = async () => {
  // Fetch all categories, lean() for performance
  const categories = await Category.find({}).lean(); 
  return buildCategoryTree(categories);
};

const getCategoryList = async () => {
  return await Category.find({}).select("name _id level parent");
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

  if (file) {
    const oldImageUrl = category.backgroundImage;
    const image = await uploadOnCloudinary(file.path);
    if (image?.url) {
      category.backgroundImage = image.url;
      if (oldImageUrl) deleteFromCloudinary(oldImageUrl).catch(() => {});
    }
  }

  return await category.save();
};

const deleteCategory = async (categoryId) => {
  if (!mongoose.isValidObjectId(categoryId)) throw new ApiError(400, "Invalid ID.");

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const category = await Category.findById(categoryId).session(session);
    if (!category) throw new ApiError(404, "Category not found.");

    // 1. Identify all categories to delete (Self + All Descendants)
    const descendantIds = await getDescendantIds(categoryId);
    const allIdsToDelete = [categoryId, ...descendantIds];

    // 2. Check if ANY books are using ANY of these categories
    const booksUsingCategories = await Book.countDocuments({ 
      category: { $in: allIdsToDelete } 
    }).session(session);

    if (booksUsingCategories > 0) {
      throw new ApiError(400, `Cannot delete: ${booksUsingCategories} books are attached to this category or its subcategories.`);
    }

    // 3. Remove this category ID from its Parent's children array
    if (category.parent) {
      await Category.findByIdAndUpdate(
        category.parent,
        { $pull: { children: categoryId } },
        { session }
      );
    }

    // 4. Delete all identified categories
    await Category.deleteMany({ _id: { $in: allIdsToDelete } }).session(session);

    await session.commitTransaction();

    // Clean up image
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