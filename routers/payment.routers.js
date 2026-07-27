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

paymentRouter.post("/cart/add",  addToCart);
paymentRouter.get("/cart", auth, getCart);
paymentRouter.put("/cart/item/:id", auth, updateCartItem);
paymentRouter.delete("/cart/clear", auth, clearCart);

paymentRouter.post("/checkout", auth, checkout);

paymentRouter.get("/my-purchases", auth, getMyPurchases);
paymentRouter.get("/purchase/:id", auth, getPurchaseDetails);

module.exports = paymentRouter;
