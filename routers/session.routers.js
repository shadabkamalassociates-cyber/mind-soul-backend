const express = require("express");
const {
  createRecordedSession,
  createLiveSession,
  getAllSessions,
  getSessionById,
  getSessionsByExpertId,
  getSessionsByCategoryId,
  updateSession,
  deleteSessions,
} = require("../controllers/session.controller");
const { auth } = require("../middleware/role");
const { sessionUpload } = require("../middleware/upload");

const sessionRouter = express.Router();

sessionRouter.post("/create", sessionUpload, createRecordedSession);
// sessionRouter.post("/live/create", createLiveSession);
sessionRouter.get("/fetch-all", getAllSessions);
sessionRouter.get("/fetch/:id", auth, getSessionById);
sessionRouter.get("/fetch-by-expert/:expert_id", getSessionsByExpertId);
sessionRouter.get("/fetch-by-category/:category_id", getSessionsByCategoryId);
sessionRouter.put("/update/:id", sessionUpload, updateSession);
sessionRouter.delete("/delete/:id", deleteSessions);
sessionRouter.delete("/delete", deleteSessions);

module.exports = sessionRouter;
