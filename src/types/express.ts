declare module "express-session" {
  interface SessionData {
    userId: string;
    role: string;
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
