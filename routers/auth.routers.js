const express = require("express");
const { register, login } = require("../controllers/auth");
const { userRole, expertRole, adminRole } = require("../middleware/role");
const authRouter = express.Router();

authRouter.post("/user/signUp", userRole, register);

authRouter.post("/user/logIn", userRole, login);

authRouter.post("/admin/logIn", adminRole, login);
// authRouter.post("/admin/signUp", adminRole, register);

module.exports = authRouter;