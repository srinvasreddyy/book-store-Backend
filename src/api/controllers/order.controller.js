import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import orderService from "../services/order.service.js";

const initiateOrder = asyncHandler(async (req, res) => {
    const result = await orderService.initiateOrder(req.body, req.user, req.headers);
    if (result.razorpayOrder) {
        return res.status(201).json(new ApiResponse(201, result, "Order initiated. Proceed to payment."));
    }
    return res.status(201).json(new ApiResponse(201, result, "Order placed successfully with Cash on Delivery."));
});

export { initiateOrder };