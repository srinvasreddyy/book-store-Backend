import { Special } from "../models/special.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

const createSpecial = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title) {
        throw new ApiError(400, "Title is required");
    }

    // Check if files were actually sent
    const imageFiles = req.files || [];
    if (imageFiles.length === 0) {
        // Optional: Throw error if at least one image is required
        // throw new ApiError(400, "At least one image is required");
    }

    const imageUrls = [];

    // Upload images to Cloudinary
    for (const file of imageFiles) {
        // With diskStorage, file.path will now be valid (e.g., public/temp/filename.jpg)
        const uploaded = await uploadOnCloudinary(file.path);
        
        if (uploaded?.url) {
            imageUrls.push(uploaded.url);
        } else {
            console.error(`Failed to upload file: ${file.originalname}`);
        }
    }

    // Strict Check: If user sent files but none uploaded, fail the request
    if (imageFiles.length > 0 && imageUrls.length === 0) {
        throw new ApiError(500, "Failed to upload images to cloud storage");
    }

    const special = await Special.create({
        title,
        description,
        images: imageUrls
    });

    return res.status(201).json(
        new ApiResponse(201, special, "Special created successfully")
    );
});

const getSpecials = asyncHandler(async (req, res) => {
    const specials = await Special.find().sort({ createdAt: -1 });
    return res.status(200).json(
        new ApiResponse(200, specials, "Specials fetched successfully")
    );
});

const updateSpecial = asyncHandler(async (req, res) => {
    const { specialId } = req.params;
    const { title, description } = req.body;

    const special = await Special.findById(specialId);
    if (!special) {
        throw new ApiError(404, "Special not found");
    }

    // Upload new images if provided
    const imageFiles = req.files || [];
    const newImageUrls = [];
    
    for (const file of imageFiles) {
        const uploaded = await uploadOnCloudinary(file.path);
        if (uploaded?.url) {
            newImageUrls.push(uploaded.url);
        }
    }

    // Update fields
    if (title) special.title = title;
    if (description !== undefined) special.description = description;
    
    // Append new images
    if (newImageUrls.length > 0) {
        if (special.images.length + newImageUrls.length > 30) {
             throw new ApiError(400, "Total images cannot exceed 30");
        }
        special.images = [...special.images, ...newImageUrls];
    }

    await special.save();

    return res.status(200).json(
        new ApiResponse(200, special, "Special updated successfully")
    );
});

const deleteSpecial = asyncHandler(async (req, res) => {
    const { specialId } = req.params;
    const special = await Special.findByIdAndDelete(specialId);

    if (!special) {
        throw new ApiError(404, "Special not found");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Special deleted successfully")
    );
});

export {
    createSpecial,
    getSpecials,
    updateSpecial,
    deleteSpecial
};