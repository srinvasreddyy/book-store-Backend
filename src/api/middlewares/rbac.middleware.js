import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const verifyAdmin = asyncHandler(async (req, _, next) => {
  if (req.user?.role !== "ADMIN") {
    throw new ApiError(403, "Forbidden: You do not have admin privileges");
  }
  next();
});

export { verifyAdmin };
