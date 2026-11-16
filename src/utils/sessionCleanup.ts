import type { Request, Response } from "express";
import mongoose from "mongoose";

// End the CURRENT session and clear the cookie
export const endSession = (req: Request, res: Response): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) return reject(err);
      res.clearCookie("_ojahub");
      resolve();
    });
  });
};

//End EVERY session of one user (all devices)
export const destroyAllUserSessions = async (userId: string): Promise<void> => {
  await mongoose.connection
    .collection("sessions")
    .deleteMany({ "session.userId": userId });
};
