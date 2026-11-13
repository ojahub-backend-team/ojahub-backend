import cors from "cors";
import express, { type NextFunction, Response, Request } from "express";
import { env } from "./config/keys.js";
import compression from "compression";
import helmet from "helmet";
import type {} from "./types/express.js";
import { createSessionMiddleware } from "./config/session.js";
import {
  appErrorHandler,
  createExpressLogger,
  notFoundRoutes,
  globalErrorHandlers,
} from "./middlewares/error.middleware.js";
import { compressionOptions, helmetOptions } from "./libs/option.js";
import authRoutes from "./routes/auth.routes.js";

declare global {
  namespace Express {
    interface Request {
      requestTime?: string;
      rawBody?: Buffer;
    }
  }
}

const app = express();

//trust proxy
app.set("trust proxy", true);

//set up global error handler - (node process level)
globalErrorHandlers();

//cors configuration
const allowedOrigins: string[] = [env.CLIENT_URL].filter(Boolean) as string[];

// local dev server for vite client
allowedOrigins.push("https://localhost:5173", "https://127.0.0.1:5174");
//local dev - port
allowedOrigins.push("https://localhost:5173", "https://127.0.0.1:5174");

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  optionsSuccessStatus: 200,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Access-Control-Allowed-Origin",
    "Access-Option-Allowed-Credentials",
  ],
  exposedHeaders: [
    "Content-Range",
    "x-Content-Range",
    "x-refresh-token",
    "set-cookie",
  ],
};

app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestTime = new Date().toISOString();
  next();
});

//health check - no logs, session, or rate limiter required
app.use("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    environment: env.NODE_ENV,
    timeStamp: req.requestTime,
    uptime: process.uptime(),
  });
});

app.use(createExpressLogger());
app.use(cors(corsOptions));
app.use(helmet(helmetOptions));
app.use(createSessionMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(compression(compressionOptions));
app.disable("x-powered-by");

//api routes
app.use("/api/auth", authRoutes);

//handle 404 and global error
app.use(notFoundRoutes);
app.use(appErrorHandler);


export default app;
