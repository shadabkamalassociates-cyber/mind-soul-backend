const {
  RtcTokenBuilder,
  RtcRole,
} = require("agora-token");

const generateRtcToken = ({
  channelName,
  uid,
  expiresIn = 3600,
}) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId) {
    throw new Error("AGORA_APP_ID is missing");
  }

  if (!appCertificate) {
    throw new Error("AGORA_APP_CERTIFICATE is missing");
  }

  if (!channelName) {
    throw new Error("Agora channel name is required");
  }

  if (!uid) {
    throw new Error("Agora UID is required");
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);

  const privilegeExpiredTs =
    currentTimestamp + expiresIn;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    Number(uid),
    RtcRole.PUBLISHER,
    privilegeExpiredTs
  );

  return token;
};

module.exports = {
  generateRtcToken,
};