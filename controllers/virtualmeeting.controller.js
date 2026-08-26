// const { generateAgoraToken } = require("../utils/agora");

const { generateRtcToken } = require("../utils/agora");
const crypto = require("crypto");

const createMeeting = async (req, res) => {
  try {
    // In production, use your authenticated user's ID
    const uid = Number(req.user.id);

    // Generate unique meeting ID
    const meetingId = crypto.randomUUID();

    // Create unique Agora channel
    const channelName = `cosmic_guru_${meetingId}`;

    // Generate Agora token
    const token = generateRtcToken({
      channelName,
      uid,
      expiresIn: 3600,
    });

    return res.status(201).json({
      success: true,
      message: "Instant meeting created",
      data: {
        meetingId,
        channelName,
        appId: process.env.AGORA_APP_ID,
        uid,
        token,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Create instant meeting error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create instant meeting",
    });
  }
};


const joinInstantMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;

    const uid = Number(req.user.id);

    if (!meetingId) {
      return res.status(400).json({
        success: false,
        message: "Meeting ID is required",
      });
    }

    const channelName = `cosmic_guru_${meetingId}`;

    const token = generateRtcToken({
      channelName,
      uid,
      expiresIn: 3600,
    });

    return res.status(200).json({
      success: true,
      message: "Joined meeting successfully",
      data: {
        meetingId,
        channelName,
        appId: process.env.AGORA_APP_ID,
        uid,
        token,
        expiresIn: 3600,
      },
    });
  } catch (error) {
    console.error("Join meeting error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to join meeting",
    });
  }
};


module.exports = {
  joinInstantMeeting,
  createMeeting
};