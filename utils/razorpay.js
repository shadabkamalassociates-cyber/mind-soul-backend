const Razorpay = require("razorpay");
const crypto = require("crypto");
const axios = require("axios");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const RAZORPAY_PKG_VERSION = require("razorpay/package.json").version;

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

/**
 * Safe error serializer for Razorpay/axios failures.
 * Never logs secrets.
 */
const serializeRazorpayError = (err) => {
  const response = err?.response;
  const data = response?.data;
  return {
    name: err?.name || null,
    message: err?.message || null,
    statusCode: err?.statusCode ?? response?.status ?? null,
    status: response?.status ?? err?.status ?? null,
    code: err?.code || data?.error?.code || null,
    reason: data?.error?.reason || null,
    description: data?.error?.description || null,
    error: data?.error || err?.error || null,
    response_data: data || null,
    stack: typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 8) : null,
  };
};

/**
 * Create order via Razorpay REST API directly.
 *
 * Why not razorpay.orders.create()?
 * razorpay@2.9.6+ uses axios and normalizeError in:
 *   node_modules/razorpay/dist/api.js (normalizeError)
 * which does `err.response.status` without optional chaining.
 * When axios fails without a response (network/DNS/timeout) OR when the
 * SDK remaps a 403 poorly, that throws:
 *   TypeError: Cannot read properties of undefined (reading 'status')
 * which hides the real failure.
 */
const createRazorpayOrder = async (amount, currency, receipt) => {
  const amountPaise = Math.round(Number(amount) * 100);

  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    throw new Error(
      `Invalid Razorpay amount in paise: ${amountPaise}. Minimum is 100 (₹1).`,
    );
  }

  const options = {
    amount: amountPaise,
    currency: currency || "INR",
    receipt: String(receipt).slice(0, 40),
    payment_capture: 1,
  };

  console.log("[razorpay] Creating order", {
    razorpay_pkg: RAZORPAY_PKG_VERSION,
    has_key_id: Boolean(RAZORPAY_KEY_ID),
    has_key_secret: Boolean(RAZORPAY_KEY_SECRET),
    key_id: maskKeyId(RAZORPAY_KEY_ID),
    mode: String(RAZORPAY_KEY_ID).startsWith("rzp_live") ? "live" : "test",
    options,
  });

  try {
    const response = await axios.post(
      "https://api.razorpay.com/v1/orders",
      options,
      {
        auth: {
          username: RAZORPAY_KEY_ID,
          password: RAZORPAY_KEY_SECRET,
        },
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 30000,
        // Never route Razorpay through inherited HTTP(S)_PROXY (e.g. Cursor sandbox).
        proxy: false,
        validateStatus: () => true,
      },
    );

    if (response.status >= 200 && response.status < 300 && response.data?.id) {
      console.log("[razorpay] Order created", {
        id: response.data.id,
        amount: response.data.amount,
        currency: response.data.currency,
        status: response.data.status || null,
      });
      return response.data;
    }

    const apiError = response.data?.error || null;
    const message =
      apiError?.description ||
      apiError?.reason ||
      apiError?.code ||
      `Razorpay order create failed (HTTP ${response.status})`;

    console.error("[razorpay] Order create failed", {
      key_id: maskKeyId(RAZORPAY_KEY_ID),
      http_status: response.status,
      response_data: response.data || null,
      code: apiError?.code || null,
      reason: apiError?.reason || null,
      description: apiError?.description || null,
      message,
    });

    const wrapped = new Error(message);
    wrapped.statusCode = response.status;
    wrapped.error = apiError;
    throw wrapped;
  } catch (err) {
    // Re-throw our own wrapped errors as-is.
    if (err?.statusCode && err?.message && !err?.isAxiosError) {
      throw err;
    }

    const details = serializeRazorpayError(err);
    console.error("[razorpay] Order create exception", {
      key_id: maskKeyId(RAZORPAY_KEY_ID),
      ...details,
    });

    const wrapped = new Error(
      details.description ||
        details.message ||
        details.code ||
        (details.statusCode
          ? `Razorpay order create failed (HTTP ${details.statusCode})`
          : "Razorpay order create failed"),
    );
    wrapped.statusCode = details.statusCode;
    wrapped.error = details.error;
    throw wrapped;
  }
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
