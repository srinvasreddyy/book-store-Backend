import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Announcement } from "../models/announcement.model.js";
import mongoose from "mongoose";

const isValidDate = (dateString) => {
    return dateString ? !isNaN(new Date(dateString).getTime()) : true;
};

const createAnnouncement = asyncHandler(async (req, res) => {
    const { title, content, startDate, endDate, isActive } = req.body;

    // --- Input Validation ---
    if (!title || title.trim() === "") {
        throw new ApiError(400, "Title is required.");
    }
    if (!content || content.trim() === "") {
        throw new ApiError(400, "Content is required.");
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new ApiError(400, "Invalid date format provided for startDate or endDate.");
    }
    // --- End Validation ---

    const announcement = await Announcement.create({
        title,
        content,
        startDate,
        endDate,
        isActive,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, announcement, "Announcement created successfully."));
});

const getActiveAnnouncements = asyncHandler(async (req, res) => {
    const now = new Date();
    
    const announcements = await Announcement.find({
        isActive: true,
        $and: [
            { $or: [{ startDate: { $lte: now } }, { startDate: null }] },
            { $or: [{ endDate: { $gte: now } }, { endDate: null }] },
        ],
    }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, announcements, "Active announcements fetched successfully."));
});

const getAllAnnouncements = asyncHandler(async (req, res) => {
    const announcements = await Announcement.find({}).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, announcements, "All announcements fetched successfully."));
});

const updateAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const { title, content, startDate, endDate, isActive } = req.body;

    // --- Input Validation ---
    if (!mongoose.isValidObjectId(announcementId)) {
        throw new ApiError(400, "Invalid announcement ID format.");
    }
    if (Object.keys(req.body).length === 0) {
        throw new ApiError(400, "At least one field must be provided to update.");
    }
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new ApiError(400, "Invalid date format provided for startDate or endDate.");
    }
    // --- End Validation ---

    const announcement = await Announcement.findByIdAndUpdate(
        announcementId,
        {
            $set: { title, content, startDate, endDate, isActive },
        },
        { new: true, runValidators: true }
    );

    if (!announcement) {
        throw new ApiError(404, "Announcement not found.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, announcement, "Announcement updated successfully."));
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    // --- Input Validation ---
    if (!mongoose.isValidObjectId(announcementId)) {
        throw new ApiError(400, "Invalid announcement ID format.");
    }
    // --- End Validation ---

    const announcement = await Announcement.findByIdAndDelete(announcementId);

    if (!announcement) {
        throw new ApiError(404, "Announcement not found.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Announcement deleted successfully."));
});

export {
    createAnnouncement,
    getActiveAnnouncements,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
};