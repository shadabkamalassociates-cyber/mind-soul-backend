const express = require("express");
const {
  submitJoinLead,
  createCommunityJoinPayment,
  verifyCommunityJoinPayment,
  getCommunityJoinPaymentStatus,
  fetchAllPayments,
  deleteJoinLead,
} = require("../controllers/communityJoin.controller");
const { auth } = require("../middleware/role");

const communityRouter = express.Router();

// communityRouter.post("/join-lead", submitJoinLead);
communityRouter.delete("/delete-lead/:id", deleteJoinLead);
communityRouter.post("/join-payment", createCommunityJoinPayment);
// Status check for logged-in users (Just99 congrats modal).
communityRouter.post("/verify-payment", auth, getCommunityJoinPaymentStatus);
// Post-checkout signature verification (also available under /payment/...).
communityRouter.post("/confirm-payment", verifyCommunityJoinPayment);
communityRouter.get("/all", fetchAllPayments);
module.exports = communityRouter;
