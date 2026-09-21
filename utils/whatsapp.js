const axios = require("axios");

const WHATSAPP_PHONE_NUMBER_ID =
  process.env.WHATSAPP_OTP_WEBHOOK_ID || "1321910100997854";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_COMMUNITY_JOIN_TEMPLATE_NAME =
  process.env.WHATSAPP_COMMUNITY_JOIN_TEMPLATE_NAME || "payment_confirmationn";
const WHATSAPP_COMMUNITY_LINK =
  process.env.WHATSAPP_COMMUNITY_LINK ||
  "https://chat.whatsapp.com/E0SZ7y0LPRdCycX308e9Lb";

const WHATSAPP_MESSAGES_URL = `https://crmapi1.whatapi.in/api/meta/v19.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

const formatWhatsAppRecipient = (mobileNumber) => {
  const digits = String(mobileNumber || "").replace(/\D/g, "");

  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;

  return digits;
};

const sendCommunityPaymentConfirmationWhatsApp = async (payment, amount = 99) => {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WHATSAPP_ACCESS_TOKEN is not configured.");
  }

  const payload = {
    to: formatWhatsAppRecipient(payment.phone),
    recipient_type: "individual",
    type: "template",
    template: {
      language: {
        policy: "deterministic",
        code: "en_GB",
      },
      name: WHATSAPP_COMMUNITY_JOIN_TEMPLATE_NAME,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: payment.name },
            { type: "text", text: String(amount) },
            { type: "text", text: payment.name },
            { type: "text", text: payment.email },
            { type: "text", text: payment.phone },
            { type: "text", text: `Amount: ₹${amount}` },
            {
              type: "text",
              text:
                "Join our community to get access to upcoming courses, latest courses, important updates, and exclusive learning content.",
            },
            { type: "text", text: "Join Community" },
            { type: "text", text: WHATSAPP_COMMUNITY_LINK },
          ],
        },
      ],
    },
  };

  const response = await axios.post(WHATSAPP_MESSAGES_URL, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    },
  });

  return response.data;
};

module.exports = {
  formatWhatsAppRecipient,
  sendCommunityPaymentConfirmationWhatsApp,
};
