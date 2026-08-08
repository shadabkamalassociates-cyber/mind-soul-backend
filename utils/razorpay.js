const Razorpay = require("razorpay");
const crypto = require("crypto");

// const RAZORPAY_KEY_ID = "rzp_live_wDtW9gcHXUjSAe";
// const RAZORPAY_KEY_SECRET = "vUi6QIDZ7HD5wQLsOShqr8ZB";

const RAZORPAY_KEY_ID = "rzp_live_TLI7xGOv7CFiRl";
const RAZORPAY_KEY_SECRET = "3aLtGIcd5pTqCYu0ktgHUPDA";

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (amount, currency, receipt) => {
  const options = {
    amount: Math.round(amount * 100),
    currency,
    receipt,
    payment_capture: 1,
  };

  return razorpay.orders.create(options);
};

const verifyPaymentSignature = (
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
) => {
  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest("hex");

  return generatedSignature === razorpaySignature;
};

const verifyWebhookSignature = (body, signature, secret) => {
  const generatedSignature = crypto
    .createHmac("sha256", secret)
    .update(JSON.stringify(body))
    .digest("hex");

  return generatedSignature === signature;
};

module.exports = {
  razorpay,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
};
