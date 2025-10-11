import { Router } from "express";
import { getAllTags } from "../controllers/tag.controller.js";

const router = Router();

// Public route
router.route("/").get(getAllTags);

export default router;