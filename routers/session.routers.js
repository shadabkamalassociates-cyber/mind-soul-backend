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

const sessionRouter = express.Router();

sessionRouter.post("/recorded/create", createRecordedSession);
sessionRouter.post("/live/create", createLiveSession);
sessionRouter.get("/fetch-all", getAllSessions);
sessionRouter.get("/fetch/:id", getSessionById);
sessionRouter.get("/fetch-by-expert/:expert_id", getSessionsByExpertId);
sessionRouter.get("/fetch-by-category/:category_id", getSessionsByCategoryId);
sessionRouter.put("/update/:id", updateSession);
sessionRouter.delete("/delete/:id", deleteSessions);
sessionRouter.delete("/delete", deleteSessions);

module.exports = sessionRouter;
