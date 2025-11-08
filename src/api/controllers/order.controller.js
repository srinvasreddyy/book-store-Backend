import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { Order } from "../models/order.model.js";
import orderService from "../services/order.service.js";
import { sendOrderStatusUpdateEmail } from "../../utils/mailer.js";

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

// User: Get orders for the authenticated user (paginated)
const getUserOrders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search, dateFrom, dateTo, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const matchConditions = { user: req.user._id };

  if (status && status !== 'all') {
    matchConditions.status = status.toUpperCase();
  }

  if (dateFrom || dateTo) {
    matchConditions.createdAt = {};
    if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
  }

  const orders = await Order.find(matchConditions)
    .populate('items.book', 'title coverImages author price')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Transform data for frontend
  const transformedOrders = orders.map(order => ({
    _id: order._id,
    id: order._id.toString(),
    books: order.items.map(item => ({
      title: item.book?.title || 'Unknown Book',
      images: item.book?.coverImages || [],
      quantity: item.quantity,
      price: item.priceAtPurchase
    })),
    date: order.createdAt.toISOString().split('T')[0],
    total: order.finalAmount,
    status: order.status.toLowerCase(),
    shippingAddress: order.shippingAddress,
    deliveryBoyName: order.deliveryBoyName,
    deliveryBoyMobile: order.deliveryBoyMobile,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  }));

  const totalOrders = await Order.countDocuments({ user: req.user._id });

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
    }, "User orders fetched successfully")
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

  if (dateFrom || dateTo) {
    matchConditions.createdAt = {};
    if (dateFrom) matchConditions.createdAt.$gte = new Date(dateFrom);
    if (dateTo) matchConditions.createdAt.$lte = new Date(dateTo);
  }

  const orders = await Order.find(matchConditions)
    // FIX 1: Use 'fullName' instead of 'name' in the populate select string.
    .populate('user', 'fullName email') 
    .populate('items.book', 'title')
    .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  // Filter by search if provided
  let filteredOrders = orders;
  if (search) {
    filteredOrders = orders.filter(order =>
      // FIX 2: Search by 'fullName' instead of 'name'.
      order.user?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      order.user?.email?.toLowerCase().includes(search.toLowerCase())
    );
  }

  // Transform data for frontend
  const transformedOrders = filteredOrders.map(order => ({
    _id: order._id,
    id: order._id.toString(),
    // FIX 3: Use 'fullName' instead of 'name' for the customer field.
    customer: order.user?.fullName || 'Unknown', 
    email: order.user?.email || '',
    shippingAddress: order.shippingAddress,
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
    .populate('user', 'fullName email')
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

  // Get the current order before updating

  const currentOrder = await Order.findById(orderId).populate('user', 'fullName email');

  if (!currentOrder) {
    throw new ApiError(404, "Order not found");
  }

  const updateData = {};
  if (status) updateData.status = status.toUpperCase();
  if (deliveryBoyName !== undefined) updateData.deliveryBoyName = deliveryBoyName;
  if (deliveryBoyMobile !== undefined) updateData.deliveryBoyMobile = deliveryBoyMobile;

  const order = await Order.findByIdAndUpdate(
    orderId,
    updateData,
    { new: true, runValidators: true }
  ).populate('user', 'fullName email');

  if (!order) {
    throw new ApiError(404, "Order not found");
  }

  // Check if status changed or delivery details were added/updated
  const statusChanged = status && currentOrder.status !== order.status;
  const deliveryAssigned = (deliveryBoyName !== undefined && currentOrder.deliveryBoyName !== order.deliveryBoyName) ||
                          (deliveryBoyMobile !== undefined && currentOrder.deliveryBoyMobile !== order.deliveryBoyMobile);

  // Send email notification if status changed or delivery person assigned
  if (statusChanged || deliveryAssigned) {
    try {
      await sendOrderStatusUpdateEmail(order);
    } catch (emailError) {
      console.error('Failed to send order status update email:', emailError);
      // Don't fail the update if email fails
    }
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

// Admin: Cleanup abandoned orders
const cleanupAbandonedOrders = asyncHandler(async (req, res) => {
  const deletedCount = await orderService.cleanupAbandonedOrders();
  
  res.status(200).json(
    new ApiResponse(200, { deletedCount }, `Cleaned up ${deletedCount} abandoned orders`)
  );
});

export {
  initiateOrder,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateOrder,
  deleteOrder,
  getOrderStats,
  cleanupAbandonedOrders
};
