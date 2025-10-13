import mongoose, { Schema } from "mongoose";

const userUsageSchema = new Schema({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  count: {
    type: Number,
    required: true,
    default: 0,
  },
});

const discountSchema = new Schema(
  {
    couponCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["PERCENTAGE", "FIXED_AMOUNT", "FREE_DELIVERY"],
      required: true,
    },
    value: {
      type: Number,
      required: function () {
        return this.type !== "FREE_DELIVERY";
      }, // Not required for free delivery
      min: 0,
    },
    minCartValue: {
      type: Number,
      default: 0,
    },
    maxUses: {
      // Total number of times the coupon can be used
      type: Number,
      required: true,
      min: 1,
    },
    maxUsesPerUser: {
      // Number of times a single user can use it
      type: Number,
      required: true,
      min: 1,
    },
    timesUsed: {
      type: Number,
      default: 0,
    },
    usedBy: [userUsageSchema],
    isActive: {
      type: Boolean,
      default: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const Discount = mongoose.model("Discount", discountSchema);
