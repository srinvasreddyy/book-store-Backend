import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Homepage } from "../models/homepage.model.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

const findOrCreateHomepage = async (userId) => {
    let homepage = await Homepage.findOne({ user: userId });
    if (!homepage) {
        homepage = await Homepage.create({ user: userId });
    }
    return homepage;
};

// --- PUBLIC CONTROLLER ---
const getHomepageByUsername = asyncHandler(async (req, res) => {
    const { adminUsername } = req.params;

    // --- Validation ---
    if (!adminUsername || adminUsername.trim() === "") {
        throw new ApiError(400, "Admin username is required.");
    }

    const admin = await User.findOne({ username: adminUsername.toLowerCase(), role: 'ADMIN' });
    if (!admin) {
        throw new ApiError(404, "No admin found with that username.");
    }

    const homepage = await Homepage.findOne({ user: admin._id }).populate('carouselImages.bookLink', 'title author');
    if (!homepage) {
        return res.status(200).json(new ApiResponse(200, {
            user: admin._id, carouselImages: [], youtubeVideos: [], shortVideos: [],
        }, "This admin has not configured their homepage yet."));
    }

    return res.status(200).json(new ApiResponse(200, homepage, "Homepage fetched successfully."));
});

// --- ADMIN-ONLY CONTROLLERS ---

const addCarouselImage = asyncHandler(async (req, res) => {
    const { title, subtitle, bookLink } = req.body;
    const imageLocalPath = req.file?.path;

    // --- Validation ---
    if (!title || title.trim() === "") throw new ApiError(400, "A title is required for the carousel image.");
    if (!imageLocalPath) throw new ApiError(400, "An image file must be uploaded.");
    if (bookLink && !mongoose.isValidObjectId(bookLink)) throw new ApiError(400, "Invalid Book ID format for book link.");

    const image = await uploadOnCloudinary(imageLocalPath);
    if (!image?.url) throw new ApiError(500, "Failed to upload image.");

    const homepage = await findOrCreateHomepage(req.user._id);
    homepage.carouselImages.push({ title, subtitle, imageUrl: image.url, bookLink: bookLink || null });
    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "Carousel image added successfully."));
});

const removeCarouselImage = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    if (!mongoose.isValidObjectId(itemId)) throw new ApiError(400, "Invalid item ID format.");

    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { carouselImages: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item could not be removed.");
    return res.status(200).json(new ApiResponse(200, homepage, "Carousel image removed successfully."));
});

const addYoutubeVideo = asyncHandler(async (req, res) => {
    const { title, description, videoUrl } = req.body;
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

    // --- Validation ---
    if (!title || title.trim() === "") throw new ApiError(400, "A title is required.");
    if (!videoUrl || !youtubeRegex.test(videoUrl)) throw new ApiError(400, "A valid YouTube video URL is required.");

    const homepage = await findOrCreateHomepage(req.user._id);
    homepage.youtubeVideos.push({ title, description, videoUrl });
    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "YouTube video added successfully."));
});

const removeYoutubeVideo = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    if (!mongoose.isValidObjectId(itemId)) throw new ApiError(400, "Invalid item ID format.");

    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { youtubeVideos: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item could not be removed.");
    return res.status(200).json(new ApiResponse(200, homepage, "YouTube video removed successfully."));
});

const addShortVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const videoLocalPath = req.file?.path;

    // --- Validation ---
    if (!title || title.trim() === "") throw new ApiError(400, "A title is required.");
    if (!videoLocalPath) throw new ApiError(400, "A video file must be uploaded.");

    const video = await uploadOnCloudinary(videoLocalPath);
    if (!video?.url) throw new ApiError(500, "Failed to upload video.");

    if (video.duration > 180) {
        // TODO: Delete the just-uploaded video from Cloudinary to clean up.
        throw new ApiError(400, "Video duration cannot exceed 3 minutes (180 seconds).");
    }

    const homepage = await findOrCreateHomepage(req.user._id);
    homepage.shortVideos.push({ title, description, videoUrl: video.url, duration: video.duration });
    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "Short video added successfully."));
});

const removeShortVideo = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    if (!mongoose.isValidObjectId(itemId)) throw new ApiError(400, "Invalid item ID format.");

    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { shortVideos: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item could not be removed.");
    return res.status(200).json(new ApiResponse(200, homepage, "Short video removed successfully."));
});

export {
    getHomepageByUsername,
    addCarouselImage,
    removeCarouselImage,
    addYoutubeVideo,
    removeYoutubeVideo,
    addShortVideo,
    removeShortVideo,
};