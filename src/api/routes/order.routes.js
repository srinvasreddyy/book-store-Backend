import { Router } from "express";
import { initiateOrder } from "../controllers/order.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/initiate").post(initiateOrder);

export default router;