
const express = require("express");
const { createMeeting, joinInstantMeeting } = require("../controllers/virtualmeeting.controller");

const virtualMeetingRouter = express.Router();
virtualMeetingRouter.post("/create", createMeeting);
virtualMeetingRouter.post("/join", joinInstantMeeting);
// virtualMeetingRouter.post("/join-lead", submitJoinLead);
// virtualMeetingRouter.post("/join-payment", createCommunityJoinPayment);
// // Status check for logged-in users (Just99 congrats modal).
// virtualMeetingRouter.post("/verify-payment", auth, getCommunityJoinPaymentStatus);
// // Post-checkout signature verification (also available under /payment/...).
// virtualMeetingRouter.post("/confirm-payment", verifyCommunityJoinPayment);
// virtualMeetingRouter.get("/all", fetchAllPayments);
module.exports = virtualMeetingRouter;
