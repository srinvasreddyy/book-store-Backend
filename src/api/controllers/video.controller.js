import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import { Book } from "../models/book.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

const uploadVideo = asyncHandler(async (req, res) => {
    const { title, description, bookId } = req.body;

    if (!title || !description || !bookId) {
        throw new ApiError(400, "Title, description, and bookId are required");
    }

    const book = await Book.findById(bookId);
    if (!book) {
        throw new ApiError(404, "Book not found");
    }

    const videoFileLocalPath = req.file?.path;
    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    if (!videoFile) {
        throw new ApiError(500, "Failed to upload video file");
    }

    const video = await Video.create({
        title,
        description,
        book: bookId,
        videoFile: videoFile.url,
        duration: videoFile.duration,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video uploaded successfully"));
});

const getVideosByBook = asyncHandler(async (req, res) => {
    const { bookId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!mongoose.isValidObjectId(bookId)) {
        throw new ApiError(400, "Invalid book ID");
    }
    
    const aggregate = Video.aggregate([{ $match: { book: new mongoose.Types.ObjectId(bookId) } }]);
    const options = { page: parseInt(page, 10), limit: parseInt(limit, 10) };
    const videos = await Video.aggregatePaginate(aggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideoDetails = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!title && !description) {
        throw new ApiError(400, "At least one field (title or description) must be provided for update");
    }

    const video = await Video.findByIdAndUpdate(
        videoId,
        { $set: { title, description } },
        { new: true }
    );

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video details updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    
    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findByIdAndDelete(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    
    // Note: Also delete from Cloudinary in production

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

export {
    uploadVideo,
    getVideosByBook,
    getVideoById,
    updateVideoDetails,
    deleteVideo
};