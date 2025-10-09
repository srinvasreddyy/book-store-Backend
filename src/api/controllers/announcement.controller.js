import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Announcement } from "../models/announcement.model.js";

const createAnnouncement = asyncHandler(async (req, res) => {
    const { title, content, startDate, endDate, isActive } = req.body;

    if (!title || !content) {
        throw new ApiError(400, "Title and content are required");
    }

    const announcement = await Announcement.create({
        title,
        content,
        startDate,
        endDate,
        isActive,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, announcement, "Announcement created successfully"));
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
        .json(new ApiResponse(200, announcements, "Active announcements fetched successfully"));
});

const getAllAnnouncements = asyncHandler(async (req, res) => {
    // Admin only
    const announcements = await Announcement.find({}).sort({ createdAt: -1 });
    return res
        .status(200)
        .json(new ApiResponse(200, announcements, "All announcements fetched successfully"));
});

const updateAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;
    const { title, content, startDate, endDate, isActive } = req.body;

    const announcement = await Announcement.findByIdAndUpdate(
        announcementId,
        {
            $set: { title, content, startDate, endDate, isActive },
        },
        { new: true }
    );

    if (!announcement) {
        throw new ApiError(404, "Announcement not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, announcement, "Announcement updated successfully"));
});

const deleteAnnouncement = asyncHandler(async (req, res) => {
    const { announcementId } = req.params;

    const announcement = await Announcement.findByIdAndDelete(announcementId);

    if (!announcement) {
        throw new ApiError(404, "Announcement not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Announcement deleted successfully"));
});

export {
    createAnnouncement,
    getActiveAnnouncements,
    getAllAnnouncements,
    updateAnnouncement,
    deleteAnnouncement,
};