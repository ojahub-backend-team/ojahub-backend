import { NextFunction, Request, Response } from "express";

type asyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => unknown | Promise<unknown>;

const tryCatchFn = (fn: asyncHandler) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

export default tryCatchFn;
