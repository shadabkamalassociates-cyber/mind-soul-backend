
const express = require("express");
const { createMeeting, joinInstantMeeting } = require("../controllers/virtualmeeting.controller");
const { auth } = require("../middleware/role");

const virtualMeetingRouter = express.Router();
virtualMeetingRouter.post("/create",  createMeeting);
virtualMeetingRouter.post("/join",  joinInstantMeeting);
virtualMeetingRouter.post("/join/:meetingId", auth, joinInstantMeeting);
module.exports = virtualMeetingRouter;
