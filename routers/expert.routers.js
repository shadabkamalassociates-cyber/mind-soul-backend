const express = require("express");
const {
  getExperts,
  updateExpert,
  deleteExperts,
  blockExpert,
  verifyExpert,
  getVerifiedUsers,
  getBlockedUsers,
} = require("../controllers/expert.controller");
const { protect } = require("../middleware/role");

const expertRouter = express.Router();

expertRouter.get("/fetch-all", getExperts);
expertRouter.put("/update/:id", updateExpert);
expertRouter.delete("/delete", deleteExperts);
expertRouter.patch("/block/:id", blockExpert);
expertRouter.patch("/verify/:id", verifyExpert);
expertRouter.get("/fetch-verified-users", getVerifiedUsers);
expertRouter.get("/fetch-blocked-users", getBlockedUsers);
module.exports = expertRouter;
