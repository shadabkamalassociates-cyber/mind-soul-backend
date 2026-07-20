const express = require("express");
const {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategories,
} = require("../controllers/category.controller");

const categoryRouter = express.Router();

categoryRouter.post("/create", createCategory);
categoryRouter.get("/fetch-all", getCategories);
categoryRouter.get("/fetch/:id", getCategoryById);
categoryRouter.put("/update/:id", updateCategory);
categoryRouter.delete("/delete/:id", deleteCategories);
categoryRouter.post("/delete", deleteCategories);

module.exports = categoryRouter;
