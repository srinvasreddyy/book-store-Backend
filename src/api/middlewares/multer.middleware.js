// src/api/middlewares/multer.middleware.js
import multer from "multer";

const storage = multer.memoryStorage();

export const upload = multer({
  storage,
});