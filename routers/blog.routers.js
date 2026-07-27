const express = require("express");
const { createBlog, getBlogs, getBlogBySlug, updateBlog, deleteBlog, deleteCategory, getBlogsByCategory } = require("../controllers/blog.controller");
const { auth } = require("../middleware/role");
const { createCategory, getCategories, getCategoryById, updateCategory } = require("../controllers/category.controller");
const blogRouter = express.Router();


blogRouter.post("/create", auth,createBlog);
blogRouter.get("/get-all",getBlogs);
blogRouter.get("/fetch-by-slug/:slug", getBlogBySlug);
blogRouter.put("/update-blog/:id",auth, updateBlog);
blogRouter.delete("/delete-blog/:id",auth, deleteBlog);
blogRouter.post("/create-category",auth, createCategory);
blogRouter.get("/get-categories",getCategories);
blogRouter.get("/get-category-by-id/:id",getCategoryById);
blogRouter.put("/update-category/:id",auth, updateCategory);
blogRouter.delete("/delete-category/:id",auth, deleteCategory);
blogRouter.get("/get-blogs-by-category/:categoryId",getBlogsByCategory);

module.exports = blogRouter;