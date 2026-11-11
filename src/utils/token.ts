import jwt from "jsonwebtoken";
import { env } from "../config/keys.js";
import { createHash } from "node:crypto";
export const generateAccessToken = (userId: string): string => {
  let accessToken = jwt.sign({ userId }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: "15m",
    algorithm: "HS256",
  });

  return accessToken;
};
export const generateRefreshToken = (
  userId: string,
  rememberMe: boolean,
): string => {
  let refreshToken = jwt.sign({ userId }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: rememberMe ? "30d" : "7d",
    algorithm: "HS256",
  });

  return refreshToken;
};
export const hashRefreshToken = (token: string): string => {
  let hashedToken = createHash("sha256").update(token).digest("hex");

  return hashedToken;
};
export const verifyRefreshToken = (
  token: string,
): { userId: string } | null => {
  try {
    let decoded = jwt.verify(token, env.REFRESH_TOKEN_SECRET, {
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
      return null;
    }

    return { userId: decoded.userId };
  } catch {
    return null;
  }
};
export const verifyAccessToken = (token: string): { userId: string } | null => {
  try {
    let decoded = jwt.verify(token, env.ACCESS_TOKEN_SECRET, {
      algorithms: ["HS256"],
    });

    if (typeof decoded === "string" || typeof decoded.userId !== "string") {
      return null;
    }

    return { userId: decoded.userId };
  } catch {
    return null;
  }
};
