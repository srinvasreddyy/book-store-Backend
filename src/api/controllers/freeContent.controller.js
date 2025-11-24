import { FreeContent } from "../models/freeContent.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

const createFreeContent = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title) {
        throw new ApiError(400, "Title is required");
    }

    const pdfLocalPath = req.files?.pdf?.[0]?.path;
    if (!pdfLocalPath) {
        throw new ApiError(400, "PDF file is required");
    }

    const pdfUpload = await uploadOnCloudinary(pdfLocalPath);
    if (!pdfUpload) {
        throw new ApiError(500, "Failed to upload PDF");
    }

    let coverImageUrl = null;
    if (req.files?.coverImage?.[0]?.path) {
        const coverUpload = await uploadOnCloudinary(req.files.coverImage[0].path);
        coverImageUrl = coverUpload?.url;
    } else {
        // Use Cloudinary's feature to generate a JPG from the first page of the PDF
        // This usually works by changing the extension or format in the URL
        // e.g. http://res.cloudinary.com/.../image.pdf -> http://res.cloudinary.com/.../image.jpg
        if (pdfUpload.url.endsWith('.pdf')) {
            coverImageUrl = pdfUpload.url.replace('.pdf', '.jpg');
        } else {
            // Fallback if url doesn't end in .pdf or for other formats
            coverImageUrl = pdfUpload.url; 
        }
    }

    const freeContent = await FreeContent.create({
        title,
        description,
        pdfUrl: pdfUpload.url,
        coverImage: coverImageUrl
    });

    return res.status(201).json(
        new ApiResponse(201, freeContent, "Free Content created successfully")
    );
});

const getFreeContent = asyncHandler(async (req, res) => {
    const content = await FreeContent.find().sort({ createdAt: -1 });
    return res.status(200).json(
        new ApiResponse(200, content, "Free Content fetched successfully")
    );
});

const updateFreeContent = asyncHandler(async (req, res) => {
    const { contentId } = req.params;
    const { title, description } = req.body;

    const content = await FreeContent.findById(contentId);
    if (!content) {
        throw new ApiError(404, "Content not found");
    }

    if (title) content.title = title;
    if (description !== undefined) content.description = description;

    // Handle PDF update
    if (req.files?.pdf?.[0]?.path) {
        const pdfUpload = await uploadOnCloudinary(req.files.pdf[0].path);
        if (pdfUpload) {
            content.pdfUrl = pdfUpload.url;
            // If cover wasn't explicitly updated, maybe auto-update it from new PDF?
            // For now, we keep old cover unless new cover is provided.
        }
    }

    // Handle Cover Image update
    if (req.files?.coverImage?.[0]?.path) {
        const coverUpload = await uploadOnCloudinary(req.files.coverImage[0].path);
        if (coverUpload) {
            content.coverImage = coverUpload.url;
        }
    }

    await content.save();

    return res.status(200).json(
        new ApiResponse(200, content, "Content updated successfully")
    );
});

const deleteFreeContent = asyncHandler(async (req, res) => {
    const { contentId } = req.params;
    const content = await FreeContent.findByIdAndDelete(contentId);

    if (!content) {
        throw new ApiError(404, "Content not found");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Content deleted successfully")
    );
});

export {
    createFreeContent,
    getFreeContent,
    updateFreeContent,
    deleteFreeContent
};