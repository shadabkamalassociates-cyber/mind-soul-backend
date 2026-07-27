const express = require("express");
const { auth } = require("../middleware/role");
const {
  addToCart,
  getCart,
  updateCartItem,
  clearCart,
  checkout,
  getMyPurchases,
  getPurchaseDetails,
} = require("../controllers/payment.controllers");

const paymentRouter = express.Router();

paymentRouter.post("/cart/add",auth,  addToCart);
paymentRouter.get("/fetch-cart", getCart);
paymentRouter.put("/cart/item/:id", auth, updateCartItem);
paymentRouter.delete("/cart/clear",clearCart);
paymentRouter.post("/checkout", auth, checkout);
paymentRouter.get("/my-purchases", auth, getMyPurchases);
paymentRouter.get("/purchase/:id", auth, getPurchaseDetails);

module.exports = paymentRouter;
