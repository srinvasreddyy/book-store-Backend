import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { Book } from "../models/book.model.js";
import { Order } from "../models/order.model.js";
import mongoose from "mongoose";

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

const getAdminBookStats = asyncHandler(async (req, res) => {
    const adminId = req.user._id;

    const [totalBooks, lowStockCount, inventoryValueResult] = await Promise.all([
        Book.countDocuments({ uploadedBy: adminId }),
        Book.countDocuments({ uploadedBy: adminId, stock: { $lt: 10 } }),
        Book.aggregate([
            { $match: { uploadedBy: new mongoose.Types.ObjectId(adminId) } },
            { $group: { _id: null, totalValue: { $sum: { $multiply: ["$price", "$stock"] } } } }
        ])
    ]);

    const stats = {
        totalBooks: totalBooks,
        lowStockCount: lowStockCount,
        inventoryValue: inventoryValueResult[0]?.totalValue || 0,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Admin book statistics fetched successfully"));
});

const getAdminSalesStats = asyncHandler(async (req, res) => {
    const adminId = req.user._id;

    const salesData = await Order.aggregate([
        { $unwind: "$items" },
        { $match: { "items.uploadedBy": new mongoose.Types.ObjectId(adminId), "status": "COMPLETED" } },
        { 
            $group: {
                _id: null,
                totalRevenue: { $sum: { $multiply: ["$items.quantity", "$items.priceAtPurchase"] } },
                unitsSold: { $sum: "$items.quantity" }
            }
        }
    ]);

    const stats = {
        totalRevenue: salesData[0]?.totalRevenue || 0,
        unitsSold: salesData[0]?.unitsSold || 0,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Admin sales statistics fetched successfully"));
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
    getAdminBookStats,
    getAdminSalesStats,
    getRecentOrders
};