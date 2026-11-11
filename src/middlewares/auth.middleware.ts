import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token.js";
import userModel from "../models/user.model.js";
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token is required",
    });
  }

  let accessToken = authHeader.split(" ")[1];

  let decoded = verifyAccessToken(accessToken);

  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired access token",
    });
  }
  let user = await userModel.findById(decoded.userId);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User account not found",
    });
  }
  req.user = {
    _id: user._id.toString(),
    role: user.role,
    businessId: user.businessId.toString(),
  };

  next();
};
