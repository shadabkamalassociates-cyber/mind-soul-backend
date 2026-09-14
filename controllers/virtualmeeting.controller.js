// const { generateAgoraToken } = require("../utils/agora");

const { generateRtcToken } = require("../utils/agora");
const crypto = require("crypto");

const createMeeting = async (req, res) => {
  try {
    // In production, use your authenticated user's ID
    id = "53752807-166a-471d-8674-e4d2c57da3a6"
    const uid =1001;

    // Generate unique meeting ID
    const meetingId = crypto.randomUUID();
    console.log(meetingId,"+++++++++++++++++++++++")
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
    const meetingId = req.params.meetingId || req.body?.meetingId;

    // Prefer authenticated user id; fall back for open join flow.
    const uid = req.user?.id ? Number(req.user.id) : 1002;

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