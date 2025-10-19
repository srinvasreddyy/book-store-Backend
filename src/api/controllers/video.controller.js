import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Video } from "../models/video.model.js";
import { Book } from "../models/book.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description, bookId } = req.body;

  // --- Input Validation ---
  if (!title || title.trim() === "")
    throw new ApiError(400, "Title is required.");
  if (!description || description.trim() === "")
    throw new ApiError(400, "Description is required.");
  if (!bookId || !mongoose.isValidObjectId(bookId)) {
    throw new ApiError(400, "A valid book ID is required.");
  }
  const videoBuffer = req.file?.buffer;
  if (!videoBuffer) {
    throw new ApiError(400, "A video file must be uploaded.");
  }
  // --- End Validation ---

  const book = await Book.findById(bookId);
  if (!book) {
    throw new ApiError(404, "The specified book does not exist.");
  }

  const videoFile = await uploadOnCloudinary(videoBuffer, "video");
  if (!videoFile) {
    throw new ApiError(500, "Failed to upload video file to cloud storage.");
  }

  const video = await Video.create({
    title,
    description,
    book: bookId,
    videoFile: videoFile.url,
    duration: videoFile.duration || 0,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video uploaded successfully."));
});

const getVideosByBook = asyncHandler(async (req, res) => {
  const { bookId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  if (!mongoose.isValidObjectId(bookId)) {
    throw new ApiError(400, "Invalid book ID format.");
  }

  const aggregate = Video.aggregate([
    { $match: { book: new mongoose.Types.ObjectId(bookId) } },
  ]);
  const options = { page: parseInt(page, 10), limit: parseInt(limit, 10) };
  const videos = await Video.aggregatePaginate(aggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully."));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format.");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video fetched successfully."));
});

const updateVideoDetails = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format.");
  }

  if (
    (!title || title.trim() === "") &&
    (!description || description.trim() === "")
  ) {
    throw new ApiError(
      400,
      "At least title or description must be provided for an update.",
    );
  }

  const updateData = {};
  if (title) updateData.title = title;
  if (description) updateData.description = description;

  const video = await Video.findByIdAndUpdate(
    videoId,
    { $set: updateData },
    { new: true, runValidators: true },
  );

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details updated successfully."));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!mongoose.isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video ID format.");
  }

  const video = await Video.findByIdAndDelete(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found.");
  }

  // TODO: In production, add logic to delete the video file from Cloudinary as well.

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted successfully."));
});

export {
  uploadVideo,
  getVideosByBook,
  getVideoById,
  updateVideoDetails,
  deleteVideo,
};
