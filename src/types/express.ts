import { UserRole } from "../models/user.model.js";

declare module "express-session" {
  interface SessionData {
    userId: string;
    role: typeof UserRole[number];
    businessId: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        _id: string;
        role: "user" | "admin";
        businessId: string;
      };
    }
  }
}

export {};
