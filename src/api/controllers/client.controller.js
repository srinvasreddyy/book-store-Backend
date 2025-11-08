import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Client } from "../models/client.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../../utils/cloudinary.js";
import mongoose from "mongoose";

// FEATURE_FLAG_CLIENT_CRUD = true (Default ON as requested)
const isFeatureEnabled = true;

const checkFeatureFlag = () => {
  if (!isFeatureEnabled) {
    throw new ApiError(503, "Client management feature is currently disabled.");
  }
};

const getClients = asyncHandler(async (req, res) => {
  checkFeatureFlag();
  const clients = await Client.find({}).sort({ createdAt: -1 });
  return res
    .status(200)
    .json(new ApiResponse(200, clients, "Clients fetched successfully."));
});

const createClient = asyncHandler(async (req, res) => {
  checkFeatureFlag();
  const { name, url } = req.body;
  const imageLocalPath = req.file?.buffer;

  if (!name || name.trim() === "") {
    throw new ApiError(400, "Client name is required.");
  }
  if (!imageLocalPath) {
    throw new ApiError(400, "Client image is required.");
  }

  const image = await uploadOnCloudinary(imageLocalPath);
  if (!image?.url) {
    throw new ApiError(500, "Failed to upload client image.");
  }

  const client = await Client.create({
    name: name.trim(),
    url: url?.trim() || "",
    image: image.url,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, client, "Client created successfully."));
});

const updateClient = asyncHandler(async (req, res) => {
  checkFeatureFlag();
  const { clientId } = req.params;
  const { name, url } = req.body;
  const imageLocalPath = req.file?.buffer;

  if (!mongoose.isValidObjectId(clientId)) {
    throw new ApiError(400, "Invalid client ID.");
  }

  const client = await Client.findById(clientId);
  if (!client) {
    throw new ApiError(404, "Client not found.");
  }

  let imageUrl = client.image;
  if (imageLocalPath) {
    const image = await uploadOnCloudinary(imageLocalPath);
    if (!image?.url) {
      throw new ApiError(500, "Failed to upload new client image.");
    }
    // Attempt to delete old image, but don't block if it fails
    if (client.image) {
      await deleteFromCloudinary(client.image).catch((err) =>
        console.error("Failed to delete old client image from Cloudinary:", err)
      );
    }
    imageUrl = image.url;
  }

  client.name = name?.trim() || client.name;
  client.url = url !== undefined ? url.trim() : client.url;
  client.image = imageUrl;
  await client.save();

  return res
    .status(200)
    .json(new ApiResponse(200, client, "Client updated successfully."));
});

const deleteClient = asyncHandler(async (req, res) => {
  checkFeatureFlag();
  const { clientId } = req.params;

  if (!mongoose.isValidObjectId(clientId)) {
    throw new ApiError(400, "Invalid client ID.");
  }

  const client = await Client.findByIdAndDelete(clientId);
  if (!client) {
    throw new ApiError(404, "Client not found.");
  }

  if (client.image) {
    await deleteFromCloudinary(client.image).catch((err) =>
      console.error("Failed to delete client image from Cloudinary:", err)
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Client deleted successfully."));
});

export { getClients, createClient, updateClient, deleteClient };