const { RtcTokenBuilder, Role } = require("agora-token");

const generateRtcToken = ({
  channelName,
  uid,
  expiresIn = 3600,
}) => {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;

  if (!appId || !appCertificate) {
    throw new Error("Agora credentials are missing");
  }

  return RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    Number(uid),
    Role.PUBLISHER,
    expiresIn,
    expiresIn
  );
};

module.exports = {
  generateRtcToken,
};