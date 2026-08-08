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
const {
  createSessionPurchase,
  verifyPayment,
} = require("../controllers/booking.contrllers");
const {
  createCommunityJoinPayment,
  verifyCommunityJoinPayment,
} = require("../controllers/communityJoin.controller");

const paymentRouter = express.Router();

paymentRouter.post("/cart/add",auth,  addToCart);
paymentRouter.get("/fetch-cart", auth, getCart);
paymentRouter.put("/cart/item/:id", auth, updateCartItem);
paymentRouter.delete("/cart/clear", auth, clearCart);
paymentRouter.post("/checkout", auth, checkout);
paymentRouter.post("/session-purchase/create", auth, createSessionPurchase);
paymentRouter.post("/session-purchase/verify-payment", auth, verifyPayment);
paymentRouter.post("/community-join/create", createCommunityJoinPayment);
paymentRouter.post("/community-join/verify-payment", verifyCommunityJoinPayment);
paymentRouter.get("/my-purchases", auth, getMyPurchases);
paymentRouter.get("/purchase/:id", auth, getPurchaseDetails);

module.exports = paymentRouter;
