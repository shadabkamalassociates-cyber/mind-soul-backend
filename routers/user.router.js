const express = require("express");
const { getUsers } = require("../controllers/users");

const userRouter = express.Router();

userRouter.get("/fetch-all", getUsers);

module.exports = userRouter;