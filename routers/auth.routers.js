const express = require("express");
const { register, login, checkAuth, sendOtp } = require("../controllers/auth");
const { userRole, expertRole, adminRole, auth } = require("../middleware/role");
const { signupUpload } = require("../middleware/upload");

const authRouter = express.Router();

authRouter.post("/user/signUp", userRole, signupUpload, register);
authRouter.post("/user/logIn", userRole, login);
authRouter.post("/user/check-auth", auth, checkAuth);
authRouter.post("/user/send-otp", sendOtp);
authRouter.post("/expert/signUp", expertRole, signupUpload, register);
authRouter.post("/expert/logIn", expertRole, login);

authRouter.post("/admin/logIn", adminRole, login);
// authRouter.post("/admin/signUp", adminRole, signupUpload, register);

module.exports = authRouter;





