import { Router } from "express";
import {
    getCart,
    addItemToCart,
    removeItemFromCart,
    clearCart
} from "../controllers/cart.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").get(getCart);
router.route("/add-item").post(addItemToCart);
router.route("/remove-item/:bookId").delete(removeItemFromCart);
router.route("/clear").post(clearCart);

export default router;