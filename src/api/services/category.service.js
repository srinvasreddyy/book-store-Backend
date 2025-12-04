import { Category } from "../models/category.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";

const createCategory = async (categoryData, file, user) => {
    const { name, parentId, description } = categoryData;
    let parentCategory = null;
    let level = 1;

    if (parentId) {
        parentCategory = await Category.findById(parentId);
        if (!parentCategory) {
            throw new ApiError(404, "Parent category not found");
        }
        if (parentCategory.level >= 4) {
            throw new ApiError(400, "Maximum category depth (4 levels) reached");
        }
        level = parentCategory.level + 1;
    }

    // Check for duplicate name at the same level (same parent)
    const existingCategory = await Category.findOne({
        name,
        parent: parentId || null
    });

    if (existingCategory) {
        throw new ApiError(409, "Category with this name already exists at this level");
    }

    let backgroundImage = null;
    if (file) {
        const uploadedImage = await uploadOnCloudinary(file.path);
        if (!uploadedImage) {
            throw new ApiError(500, "Failed to upload image");
        }
        backgroundImage = uploadedImage.secure_url;
    }

    const category = await Category.create({
        name,
        description,
        backgroundImage,
        parent: parentId || null,
        level,
        owner: user._id
    });

    if (parentCategory) {
        parentCategory.children.push(category._id);
        await parentCategory.save();
    }

    return category;
};

const getAllCategories = async () => {
    // Fetch all categories. 
    // Optimization: Depending on frontend need, we could fetch as tree here, 
    // but typically fetching flat list and building tree on frontend is flexible.
    // Populate children for immediate reference if needed.
    const categories = await Category.find()
        .populate('parent', 'name')
        .sort({ createdAt: -1 }); // Default sort by creation
    return categories;
};

const getCategoryById = async (categoryId) => {
    const category = await Category.findById(categoryId).populate('children');
    if (!category) {
        throw new ApiError(404, "Category not found");
    }
    return category;
};

const updateCategory = async (categoryId, updateData, file) => {
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    if (file) {
        if (category.backgroundImage) {
            // Extract publicId logic or just delete old one
            // Ideally we store public_id in DB, but assuming just URL here:
            // await deleteFromCloudinary(category.backgroundImage);
        }
        const uploadedImage = await uploadOnCloudinary(file.path);
        if (uploadedImage) {
            category.backgroundImage = uploadedImage.secure_url;
        }
    }

    if (updateData.name) category.name = updateData.name;
    if (updateData.description) category.description = updateData.description;

    await category.save();
    return category;
};

const deleteCategory = async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    // Recursive delete or block if children exist?
    // Implementation: Prevent delete if children exist to maintain tree integrity
    if (category.children && category.children.length > 0) {
        throw new ApiError(400, "Cannot delete category with sub-categories. Delete children first.");
    }

    // Remove reference from parent
    if (category.parent) {
        await Category.findByIdAndUpdate(category.parent, {
            $pull: { children: category._id }
        });
    }

    await Category.findByIdAndDelete(categoryId);
};

// NEW FUNCTION: Toggle Pin
const togglePin = async (categoryId) => {
    const category = await Category.findById(categoryId);
    if (!category) {
        throw new ApiError(404, "Category not found");
    }

    // Toggle logic
    if (category.isPinned) {
        category.isPinned = false;
        category.pinnedAt = null;
    } else {
        category.isPinned = true;
        category.pinnedAt = new Date(); // Set timestamp for chronological sorting
    }

    await category.save();
    return category;
};

export default {
    createCategory,
    getAllCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    togglePin
};