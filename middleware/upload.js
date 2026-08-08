const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only images (jpeg, png, webp) and documents (pdf, doc, docx) are allowed."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

const signupUpload = upload.fields([
  { name: "profile_image", maxCount: 1 },
  { name: "cover_image", maxCount: 1 },
]);

const blogUpload = upload.fields([
  { name: "featured_image", maxCount: 1 },
  { name: "banner_image", maxCount: 1 },
]);

const sessionUpload = upload.fields([{ name: "thumbnail", maxCount: 1 }]);

module.exports = {
  upload,
  signupUpload,
  blogUpload,
  sessionUpload,
};
