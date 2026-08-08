const express = require("express");
const {
  submitJoinLead,
  createCommunityJoinPayment,
  verifyCommunityJoinPayment,
  fetchAllPayments,
} = require("../controllers/communityJoin.controller");
const { auth } = require("../middleware/role");

const communityRouter = express.Router();

communityRouter.post("/join-lead", submitJoinLead);
communityRouter.post("/join-payment", createCommunityJoinPayment);
communityRouter.post("/verify-payment",auth, verifyCommunityJoinPayment);
communityRouter.get("/all", fetchAllPayments);
module.exports = communityRouter;
