const express = require("express");
const { getUsers } = require("../controllers/users");
const { getExperts, getUsersById } = require("../controllers/expert.controller");
const { userRole } = require("../middleware/role");

const userRouter = express.Router();

userRouter.get("/fetch-all",userRole, getExperts);
userRouter.get("/fetch-by-id/:id",userRole, getUsersById);

module.exports = userRouter;