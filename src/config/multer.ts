import multer from "multer";

// Configure Multer to keep uploaded files in memory for Cloudinary.
const storage = multer.memoryStorage();

// Configure accepted image file types.
const fileFilter: multer.Options["fileFilter"] = (_req, file, callback) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

  if (!allowedTypes.includes(file.mimetype)) {
    callback(new Error("Only JPEG, PNG, and WEBP images are allowed"));
    return;
  }

  callback(null, true);
};

// Configure Multer upload limits and storage.
const uploadProductImage = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

export default uploadProductImage;
