const express = require("express");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategories,
} = require("../controllers/category.controller");
const { upload } = require("../middleware/upload");

const categoryRouter = express.Router();

categoryRouter.post("/create", upload.single("icon"), createCategory);
categoryRouter.get("/fetch-all", getCategories);
categoryRouter.get("/fetch/:id", getCategoryById);
categoryRouter.put("/update/:id", upload.single("icon"), updateCategory);
categoryRouter.delete("/delete/:id", deleteCategories);
categoryRouter.post("/delete", deleteCategories);

module.exports = categoryRouter;
