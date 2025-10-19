import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import orderService from "../services/order.service.js";

const initiateOrder = asyncHandler(async (req, res) => {
  const result = await orderService.initiateOrder(
    req.body,
    req.user,
    req.headers,
  );
  if (result.razorpayOrder) {
    return res
      .status(201)
      .json(
        new ApiResponse(201, result, "Order initiated. Proceed to payment."),
      );
  }
  return res
    .status(201)
    .json(
      new ApiResponse(
        201,
        result,
        "Order placed successfully with Cash on Delivery.",
      ),
    );
});

// Admin: Get all orders with pagination and filters
const getAllOrders = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    status,
    search,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  const matchConditions = {};

  if (status && status !== 'all') {
    matchConditions.status = status.toUpperCase();
  }

  if (search) {
    // We'll handle search after population
  }

  if (dateFrom || dateTo) {
    matchConditions.createdAt = {};
    if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
  }

  const orders = await Order.find(matchConditions)
    .populate('user', 'name email')
    .populate('items.book', 'title')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Filter by search if provided
  let filteredOrders = orders;
  if (search) {
    filteredOrders = orders.filter(order =>
      order.user?.name?.toLowerCase().includes(search.toLowerCase()) ||
      order.user?.email?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Transform data for frontend
  const transformedOrders = filteredOrders.map(order => ({
    _id: order._id,
    id: order._id.toString(),
    customer: order.user?.name || 'Unknown',
    email: order.user?.email || '',
    books: order.items.map(item => ({
      title: item.book?.title || 'Unknown Book',
      quantity: item.quantity,
      price: item.priceAtPurchase
    })),
    date: order.createdAt.toISOString().split('T')[0],
    total: order.finalAmount,
    status: order.status.toLowerCase(),
    deliveryBoyName: order.deliveryBoyName,
    deliveryBoyMobile: order.deliveryBoyMobile,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }));

  const totalOrders = await Order.countDocuments(matchConditions);

  res.status(200).json(
    new ApiResponse(200, {
      orders: transformedOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalOrders / limit),
        totalOrders,
        hasNext: page * limit < totalOrders,
        hasPrev: page > 1
      }
    }, "Orders fetched successfully")
  );
});

// Admin: Get single order details
const getOrderById = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findById(orderId)
    .populate('user', 'name email')
    .populate('items.book', 'title author price')
    .populate('appliedDiscount', 'code discountPercent');

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  res.status(200).json(
    new ApiResponse(200, order, "Order details fetched successfully")
  );
});

// Admin: Update order status and delivery details
const updateOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  const { status, deliveryBoyName, deliveryBoyMobile } = req.body;

  const updateData = {};
  if (status) updateData.status = status.toUpperCase();
  if (deliveryBoyName !== undefined) updateData.deliveryBoyName = deliveryBoyName;
  if (deliveryBoyMobile !== undefined) updateData.deliveryBoyMobile = deliveryBoyMobile;

  const order = await Order.findByIdAndUpdate(
    orderId,
    updateData,
    { new: true, runValidators: true }
  ).populate('user', 'name email');

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  res.status(200).json(
    new ApiResponse(200, order, "Order updated successfully")
  );
});

// Admin: Delete order
const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findByIdAndDelete(orderId);

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  res.status(200).json(
    new ApiResponse(200, null, "Order deleted successfully")
  );
});

// Admin: Get order statistics
const getOrderStats = asyncHandler(async (req, res) => {
  const stats = await Order.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  const statusCounts = {
    total: 0,
    pending: 0,
    processing: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    failed: 0
  };

  stats.forEach(stat => {
    const status = stat._id.toLowerCase();
    statusCounts[status] = stat.count;
    statusCounts.total += stat.count;
  });

  res.status(200).json(
    new ApiResponse(200, statusCounts, "Order statistics fetched successfully")
  );
});

export {
  initiateOrder,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats
};
