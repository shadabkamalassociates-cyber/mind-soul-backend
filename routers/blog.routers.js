const express = require("express");
const { createBlog, getBlogs, getBlogBySlug, updateBlog, deleteBlog, deleteCategory, getBlogsByCategory, createCategoryForBlog, getCategoriesForBlog, getCategoryByIdForBlog, updateCategoryForBlog, deleteCategoryForBlog, getBlogsByCategoryForBlog } = require("../controllers/blog.controller");
const { auth } = require("../middleware/role");
const { blogUpload, upload } = require("../middleware/upload");
const { createCategory, getCategories, getCategoryById, updateCategory } = require("../controllers/category.controller");
const blogRouter = express.Router();


blogRouter.post("/create",  blogUpload, createBlog);
blogRouter.get("/get-all",getBlogs);
blogRouter.get("/fetch-by-slug/:slug", getBlogBySlug);
blogRouter.put("/update-blog/:id", auth, blogUpload, updateBlog);
blogRouter.delete("/delete-blog/:id",auth, deleteBlog);
blogRouter.post("/create-category",  upload.single("image_url"), createCategoryForBlog);
blogRouter.get("/get-categories",getCategoriesForBlog);
blogRouter.get("/get-category-by-id/:id",getCategoryByIdForBlog);
blogRouter.put("/update-category/:id", auth, upload.single("image_url"), updateCategoryForBlog);
blogRouter.delete("/delete-category/:id",auth, deleteCategoryForBlog    );
blogRouter.get("/get-blogs-by-category/:categoryId",getBlogsByCategoryForBlog);

module.exports = blogRouter;