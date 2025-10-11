import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Tag } from "../models/tag.model.js";

const getAllTags = asyncHandler(async (req, res) => {
    const tags = await Tag.find({}).sort({ name: 1 });
    return res
        .status(200)
        .json(new ApiResponse(200, tags, "Tags fetched successfully"));
});

export {
    getAllTags
};