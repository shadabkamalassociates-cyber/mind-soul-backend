const express = require("express");
const {
  createOrUpdateRating,
  updateRating,
  deleteRating,
  getRatingsByCategory,
  getUserCategoryRating,
} = require("../controllers/rating.controller");

const ratingRouter = express.Router();

ratingRouter.post("/create", createOrUpdateRating);
ratingRouter.put("/update/:id", updateRating);
ratingRouter.delete("/delete/:id", deleteRating);
ratingRouter.get("/category/:category_id", getRatingsByCategory);
ratingRouter.get("/user/:user_id/category/:category_id", getUserCategoryRating);

module.exports = ratingRouter;
