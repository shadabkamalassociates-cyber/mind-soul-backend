const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const dotenv = require("dotenv");

dotenv.config({ path: "./.env" });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadToCloudinary = (file, folder = "mind-soul") => {
  return new Promise((resolve, reject) => {
    if (!file) {
      return resolve(null);
    }

    const resourceType = file.mimetype?.startsWith("image/")
      ? "image"
      : "raw";

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        public_id: `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(uploadStream);
  });
};

const uploadMultipleToCloudinary = async (files = [], folder = "mind-soul") => {
  if (!files.length) {
    return [];
  }

  const uploads = files.map((file) => uploadToCloudinary(file, folder));
  return Promise.all(uploads);
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  uploadMultipleToCloudinary,
};
