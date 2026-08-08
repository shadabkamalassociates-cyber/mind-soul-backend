const express = require("express");
const {
  getExperts,
  updateExpert,
  deleteExperts,
  blockExpert,
  verifyExpert,
  getVerifiedUsers,
  getBlockedUsers,
  getUsersById,
} = require("../controllers/expert.controller");
const { protect, expertRole, auth } = require("../middleware/role");
const { signupUpload } = require("../middleware/upload");

const expertRouter = express.Router();

expertRouter.get("/fetch-all", expertRole, getExperts);
expertRouter.put("/update/:id", signupUpload, updateExpert);
expertRouter.get("/fetch-by-id/:id", expertRole, getUsersById);
expertRouter.delete("/delete", deleteExperts);
expertRouter.patch("/block/:id", blockExpert);
expertRouter.patch("/verify/:id",  verifyExpert);
expertRouter.get("/fetch-verified-users", getVerifiedUsers);
expertRouter.get("/fetch-blocked-users", getBlockedUsers);
module.exports = expertRouter;
