import { Client } from "../models/client.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

const createClient = asyncHandler(async (req, res) => {
    const { name, url } = req.body;

    if (!name) {
        throw new ApiError(400, "Client name is required");
    }

    const logoLocalPath = req.file?.path;
    if (!logoLocalPath) {
        throw new ApiError(400, "Client logo is required");
    }

    const logoUpload = await uploadOnCloudinary(logoLocalPath);
    if (!logoUpload) {
        throw new ApiError(500, "Failed to upload logo");
    }

    const client = await Client.create({
        name,
        url,
        logo: logoUpload.url
    });

    return res.status(201).json(
        new ApiResponse(201, client, "Client created successfully")
    );
});

const getClients = asyncHandler(async (req, res) => {
    const clients = await Client.find().sort({ createdAt: -1 });
    return res.status(200).json(
        new ApiResponse(200, clients, "Clients fetched successfully")
    );
});

const updateClient = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { name, url, isActive } = req.body;

    const client = await Client.findById(clientId);
    if (!client) {
        throw new ApiError(404, "Client not found");
    }

    if (name) client.name = name;
    if (url !== undefined) client.url = url;
    if (isActive !== undefined) client.isActive = isActive;

    // Update logo if a new file is provided
    if (req.file?.path) {
        const logoUpload = await uploadOnCloudinary(req.file.path);
        if (logoUpload) {
            client.logo = logoUpload.url;
        }
    }

    await client.save();

    return res.status(200).json(
        new ApiResponse(200, client, "Client updated successfully")
    );
});

const deleteClient = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const client = await Client.findByIdAndDelete(clientId);

    if (!client) {
        throw new ApiError(404, "Client not found");
    }

    return res.status(200).json(
        new ApiResponse(200, {}, "Client deleted successfully")
    );
});

export {
    createClient,
    getClients,
    updateClient,
    deleteClient
};