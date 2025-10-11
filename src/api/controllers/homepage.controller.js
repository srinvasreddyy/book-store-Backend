import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Homepage } from "../models/homepage.model.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

// A helper function to find or create a homepage for a user
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
    const admin = await User.findOne({ username: adminUsername, role: 'ADMIN' });

    if (!admin) {
        throw new ApiError(404, "Admin not found");
    }

    const homepage = await Homepage.findOne({ user: admin._id }).populate('carouselImages.bookLink', 'title author');

    if (!homepage) {
        // Return a default empty structure if the admin hasn't set up their page yet
        return res.status(200).json(new ApiResponse(200, {
            user: admin._id,
            carouselImages: [],
            youtubeVideos: [],
            shortVideos: [],
        }, "Admin homepage is not yet configured."));
    }

    return res.status(200).json(new ApiResponse(200, homepage, "Homepage fetched successfully"));
});


// --- ADMIN-ONLY CONTROLLERS ---

// Carousel Management
const addCarouselImage = asyncHandler(async (req, res) => {
    const { title, subtitle, bookLink } = req.body;
    const imageLocalPath = req.file?.path;

    if (!title) throw new ApiError(400, "Title is required for a carousel image.");
    if (!imageLocalPath) throw new ApiError(400, "Image file is required.");
    
    const image = await uploadOnCloudinary(imageLocalPath);
    if (!image.url) throw new ApiError(500, "Failed to upload image.");

    const homepage = await findOrCreateHomepage(req.user._id);

    homepage.carouselImages.push({
        title,
        subtitle,
        imageUrl: image.url,
        bookLink: bookLink || null
    });

    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "Carousel image added successfully."));
});

const removeCarouselImage = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { carouselImages: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item not in carousel.");
    return res.status(200).json(new ApiResponse(200, homepage, "Carousel image removed successfully."));
});

// YouTube Video Management
const addYoutubeVideo = asyncHandler(async (req, res) => {
    const { title, description, videoUrl } = req.body;
    if (!title || !videoUrl) throw new ApiError(400, "Title and YouTube URL are required.");

    const homepage = await findOrCreateHomepage(req.user._id);
    homepage.youtubeVideos.push({ title, description, videoUrl });
    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "YouTube video added successfully."));
});

const removeYoutubeVideo = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { youtubeVideos: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item not found.");
    return res.status(200).json(new ApiResponse(200, homepage, "YouTube video removed successfully."));
});


// Short Video Management
const addShortVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;
    const videoLocalPath = req.file?.path;

    if (!title) throw new ApiError(400, "Title is required for a short video.");
    if (!videoLocalPath) throw new ApiError(400, "Video file is required.");

    const video = await uploadOnCloudinary(videoLocalPath);
    if (!video.url) throw new ApiError(500, "Failed to upload video.");

    if (video.duration > 180) { // 3 minutes = 180 seconds
        // In a real app, you would also delete the uploaded video from Cloudinary here
        throw new ApiError(400, "Video duration cannot exceed 3 minutes.");
    }

    const homepage = await findOrCreateHomepage(req.user._id);
    homepage.shortVideos.push({
        title,
        description,
        videoUrl: video.url,
        duration: video.duration
    });

    await homepage.save();
    return res.status(201).json(new ApiResponse(201, homepage, "Short video added successfully."));
});

const removeShortVideo = asyncHandler(async (req, res) => {
    const { itemId } = req.params;
    const homepage = await Homepage.findOneAndUpdate(
        { user: req.user._id },
        { $pull: { shortVideos: { _id: itemId } } },
        { new: true }
    );
    if (!homepage) throw new ApiError(404, "Homepage not found or item not found.");
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