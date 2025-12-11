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
const getHomepageByAdminId = asyncHandler(async (req, res) => {
  const { adminId } = req.params;

  if (!mongoose.isValidObjectId(adminId)) {
    throw new ApiError(400, "Invalid admin ID format.");
  }

  const admin = await User.findOne({ _id: adminId, role: "ADMIN" });
  if (!admin) {
    throw new ApiError(404, "No admin found with that ID.");
  }

  const homepage = await Homepage.findOne({ user: admin._id }).populate(
    "carouselImages.bookLink",
    "title author",
  );
  if (!homepage) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          user: admin._id,
          carouselImages: [],
          youtubeVideos: [],
          shortVideos: [],
          footerContent: {},
        },
        "This admin has not configured their homepage yet.",
      ),
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, homepage, "Homepage fetched successfully."));
});

// --- PUBLIC CONTROLLER FOR CLIENT ---
const getPublicHomepage = asyncHandler(async (req, res) => {
  const homepage = await Homepage.findOne({
    $or: [
      { 'carouselImages.0': { $exists: true } },
      { 'youtubeVideos.0': { $exists: true } },
      { 'shortVideos.0': { $exists: true } },
    ],
  }).populate('carouselImages.bookLink', 'title author');

  if (!homepage) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          carouselImages: [],
          youtubeVideos: [],
          shortVideos: [],
          footerContent: {},
        },
        'Homepage not configured yet.',
      ),
    );
  }

  return res.status(200).json(new ApiResponse(200, homepage, 'Homepage fetched successfully.'));
});

// --- ADMIN-ONLY CONTROLLERS ---

const addCarouselImage = asyncHandler(async (req, res) => {
  const { title, subtitle, bookLink } = req.body;
  // FIX: Use req.file.path instead of req.file.buffer because multer uses diskStorage
  const imageLocalPath = req.file?.path; 

  // --- Validation ---
  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required for the carousel image.");
  
  // This check was failing because req.file.buffer was undefined
  if (!imageLocalPath)
    throw new ApiError(400, "An image file must be uploaded.");
    
  if (bookLink && !mongoose.isValidObjectId(bookLink))
    throw new ApiError(400, "Invalid Book ID format for book link.");

  const image = await uploadOnCloudinary(imageLocalPath);
  if (!image?.url) throw new ApiError(500, "Failed to upload image.");

  const homepage = await findOrCreateHomepage(req.user._id);
  homepage.carouselImages.push({
    title,
    subtitle,
    imageUrl: image.url,
    bookLink: bookLink || null,
  });
  await homepage.save();
  return res
    .status(201)
    .json(new ApiResponse(201, homepage, "Carousel image added successfully."));
});

const removeCarouselImage = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");

  const homepage = await Homepage.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { carouselImages: { _id: itemId } } },
    { new: true },
  );
  if (!homepage)
    throw new ApiError(404, "Homepage not found or item could not be removed.");
  return res
    .status(200)
    .json(
      new ApiResponse(200, homepage, "Carousel image removed successfully."),
    );
});

const updateCarouselImage = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { title, subtitle, bookLink } = req.body;

  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");
  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required for the carousel image.");
  if (bookLink && !mongoose.isValidObjectId(bookLink))
    throw new ApiError(400, "Invalid Book ID format for book link.");

  const homepage = await Homepage.findOneAndUpdate(
    { 
      user: req.user._id,
      "carouselImages._id": itemId 
    },
    { 
      $set: { 
        "carouselImages.$.title": title,
        "carouselImages.$.subtitle": subtitle || "",
        "carouselImages.$.bookLink": bookLink || null
      } 
    },
    { new: true }
  );

  if (!homepage)
    throw new ApiError(404, "Homepage or carousel image not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, homepage, "Carousel image updated successfully."));
});

const addYoutubeVideo = asyncHandler(async (req, res) => {
  const { title, description, videoUrl } = req.body;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required.");
  if (!videoUrl || !youtubeRegex.test(videoUrl))
    throw new ApiError(400, "A valid YouTube video URL is required.");

  const homepage = await findOrCreateHomepage(req.user._id);
  homepage.youtubeVideos.push({ title, description, videoUrl });
  await homepage.save();
  return res
    .status(201)
    .json(new ApiResponse(201, homepage, "YouTube video added successfully."));
});

const removeYoutubeVideo = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");

  const homepage = await Homepage.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { youtubeVideos: { _id: itemId } } },
    { new: true },
  );
  if (!homepage)
    throw new ApiError(404, "Homepage not found or item could not be removed.");
  return res
    .status(200)
    .json(
      new ApiResponse(200, homepage, "YouTube video removed successfully."),
    );
});

const updateYoutubeVideo = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { title, description, videoUrl } = req.body;
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/;

  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");
  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required.");
  if (!videoUrl || !youtubeRegex.test(videoUrl))
    throw new ApiError(400, "A valid YouTube video URL is required.");

  const homepage = await Homepage.findOneAndUpdate(
    { 
      user: req.user._id,
      "youtubeVideos._id": itemId 
    },
    { 
      $set: { 
        "youtubeVideos.$.title": title,
        "youtubeVideos.$.description": description || "",
        "youtubeVideos.$.videoUrl": videoUrl
      } 
    },
    { new: true }
  );

  if (!homepage)
    throw new ApiError(404, "Homepage or YouTube video not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, homepage, "YouTube video updated successfully."));
});

const addShortVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // FIX: Use req.file.path instead of req.file.buffer
  const videoLocalPath = req.file?.path;

  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required.");
  if (!videoLocalPath)
    throw new ApiError(400, "A video file must be uploaded.");

  const video = await uploadOnCloudinary(videoLocalPath);
  if (!video?.url) throw new ApiError(500, "Failed to upload video.");

  if (video.duration > 180) {
    throw new ApiError(
      400,
      "Video duration cannot exceed 3 minutes (180 seconds).",
    );
  }

  const homepage = await findOrCreateHomepage(req.user._id);
  homepage.shortVideos.push({
    title,
    description,
    videoUrl: video.url,
    duration: video.duration,
  });
  await homepage.save();
  return res
    .status(201)
    .json(new ApiResponse(201, homepage, "Short video added successfully."));
});

const removeShortVideo = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");

  const homepage = await Homepage.findOneAndUpdate(
    { user: req.user._id },
    { $pull: { shortVideos: { _id: itemId } } },
    { new: true },
  );
  if (!homepage)
    throw new ApiError(404, "Homepage not found or item could not be removed.");
  return res
    .status(200)
    .json(new ApiResponse(200, homepage, "Short video removed successfully."));
});

const updateShortVideo = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { title, description } = req.body;

  if (!mongoose.isValidObjectId(itemId))
    throw new ApiError(400, "Invalid item ID format.");
  if (!title || title.trim() === "")
    throw new ApiError(400, "A title is required.");

  const homepage = await Homepage.findOneAndUpdate(
    { 
      user: req.user._id,
      "shortVideos._id": itemId 
    },
    { 
      $set: { 
        "shortVideos.$.title": title,
        "shortVideos.$.description": description || ""
      } 
    },
    { new: true }
  );

  if (!homepage)
    throw new ApiError(404, "Homepage or short video not found.");

  return res
    .status(200)
    .json(new ApiResponse(200, homepage, "Short video updated successfully."));
});

const updateFooterContent = asyncHandler(async (req, res) => {
  const {
    email,
    phoneNumber,
    facebookUrl,
    instagramUrl,
    linkedInUrl
  } = req.body;
  
  const homepage = await findOrCreateHomepage(req.user._id);

  if (!homepage.footerContent) {
    homepage.footerContent = {};
  }

  homepage.footerContent.email = email ?? homepage.footerContent.email;
  homepage.footerContent.phoneNumber = phoneNumber ?? homepage.footerContent.phoneNumber;
  homepage.footerContent.facebookUrl = facebookUrl ?? homepage.footerContent.facebookUrl;
  homepage.footerContent.instagramUrl = instagramUrl ?? homepage.footerContent.instagramUrl;
  homepage.footerContent.linkedInUrl = linkedInUrl ?? homepage.footerContent.linkedInUrl;

  try {
    const updatedHomepage = await homepage.save({ validateBeforeSave: true });
    return res
      .status(200)
      .json(new ApiResponse(200, updatedHomepage, "Footer content updated successfully."));
  } catch (error) {
    if (error.name === 'ValidationError') {
      throw new ApiError(400, "Validation failed: " + error.message);
    }
    throw error;
  }
});

export {
  getHomepageByAdminId as getHomepageByUsername,
  getHomepageByAdminId,
  getPublicHomepage,
  addCarouselImage,
  removeCarouselImage,
  updateCarouselImage,
  addYoutubeVideo,
  removeYoutubeVideo,
  updateYoutubeVideo,
  addShortVideo,
  removeShortVideo,
  updateShortVideo,
  updateFooterContent, 
};