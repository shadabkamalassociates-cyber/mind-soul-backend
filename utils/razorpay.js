const Razorpay = require("razorpay");
const crypto = require("crypto");
require("dotenv").config();

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  throw new Error(
    "Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET in environment.",
  );
}

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET,
});

const maskKeyId = (keyId) => {
  const value = String(keyId || "");
  if (value.length < 12) return "[redacted]";
  return `${value.slice(0, 12)}...`;
};

const createRazorpayOrder = async (amount, currency, receipt) => {
  const amountPaise = Math.round(Number(amount) * 100);

  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error(
      `Invalid Razorpay amount in paise: ${amountPaise}. Minimum is 100 (₹1).`,
    );
  }

  const options = {
    amount: amountPaise,
    currency,
    receipt: String(receipt).slice(0, 40),
    payment_capture: 1,
  };

  console.log("[razorpay] Creating order", {
    key_id: maskKeyId(RAZORPAY_KEY_ID),
    mode: String(RAZORPAY_KEY_ID).startsWith("rzp_live") ? "live" : "test",
    amount_rupees: amount,
    amount_paise: amountPaise,
    currency,
    receipt: options.receipt,
  });

  const order = await razorpay.orders.create(options);

  console.log("[razorpay] Order created", {
    id: order.id,
    amount: order.amount,
    currency: order.currency,
    status: order.status,
  });

  return order;
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
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  maskKeyId,
};
