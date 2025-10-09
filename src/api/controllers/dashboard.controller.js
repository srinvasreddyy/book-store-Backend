import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Book } from "../models/book.model.js";
import { Order } from "../models/order.model.js";

const getDashboardStats = asyncHandler(async (req, res) => {
    const [userCount, bookCount, orderCount, totalRevenueResult] = await Promise.all([
        User.countDocuments(),
        Book.countDocuments(),
        Order.countDocuments({ status: 'COMPLETED' }),
        Order.aggregate([
            { $match: { status: 'COMPLETED' } },
            { $group: { _id: null, total: { $sum: "$totalAmount" } } }
        ])
    ]);

    const stats = {
        totalUsers: userCount,
        totalBooks: bookCount,
        totalOrders: orderCount,
        totalRevenue: totalRevenueResult[0]?.total || 0,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Dashboard statistics fetched successfully"));
});

const getRecentOrders = asyncHandler(async (req, res) => {
    const recentOrders = await Order.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("user", "fullName email");

    return res
        .status(200)
        .json(new ApiResponse(200, recentOrders, "Recent orders fetched successfully"));
});

export {
    getDashboardStats,
    getRecentOrders
};