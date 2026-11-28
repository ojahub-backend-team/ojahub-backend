import { v2 as cloudinary } from "cloudinary";
import { env } from "./keys.js";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// Export the configured Cloudinary instance for use elsewhere.
export default cloudinary;
