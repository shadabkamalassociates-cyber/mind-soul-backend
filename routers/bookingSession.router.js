const express = require("express");
const {
  createSessionPurchase,
  verifyPayment,
} = require("../controllers/booking.contrllers");
const { auth } = require("../middleware/role");

const sessionBookingRouter = express.Router();

sessionBookingRouter.post("/create",  createSessionPurchase);
sessionBookingRouter.post("/verify-payment", auth, verifyPayment);

module.exports = sessionBookingRouter;
