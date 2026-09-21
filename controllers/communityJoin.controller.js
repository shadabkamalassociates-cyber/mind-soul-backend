const { client } = require("../cleint/client");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  razorpay,
  RAZORPAY_KEY_ID,
  maskKeyId,
} = require("../utils/razorpay");

const COMMUNITY_JOIN_AMOUNT = 11;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizePhone = (phone) => String(phone || "").replace(/\D/g, "");

const submitJoinLead = async (req, res) => {
  try {
    const {
      name,
      first_name,
      last_name,
      email,
      phone,
      source = "website_popup",
    } = req.body;

    const fullName =
      String(name || "").trim() ||
      [first_name, last_name].filter(Boolean).join(" ").trim();

    if (!fullName || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "name, email and phone are required.",
      });
    }

    await client.query(
      `
      INSERT INTO community_join_leads (name, email, phone, source)
      VALUES ($1, $2, $3, $4)
      `,
      [fullName, normalizeEmail(email), phone.trim(), source]
    );

    return res.status(201).json({
      success: true,
      message: "Lead saved successfully.",
    });
  } catch (error) {
    console.error("Submit Join Lead Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
const createCommunityJoinPayment = async (req, res) => {
  try {
    const {
      name,
      first_name,
      last_name,
      email,
      phone,
      payment_type = "full",
      amount = COMMUNITY_JOIN_AMOUNT,
      notes = null,
      source = "website_popup",
    } = req.body;

    const fullName =
      String(name || "").trim() ||
      [first_name, last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    console.log("[community-join/create] request received", {
      name: fullName ? "[provided]" : "[missing]",
      email: email ? normalizeEmail(email) : "[missing]",
      phone: phone ? normalizePhone(phone) : "[missing]",
      amount,
      source,
      key_id: maskKeyId(RAZORPAY_KEY_ID),
    });

    // -----------------------------------------
    // 1. Validate customer details
    // -----------------------------------------

    if (!fullName || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "name, email and phone are required.",
      });
    }

    // -----------------------------------------
    // 2. Validate amount
    // -----------------------------------------

    const finalAmount = COMMUNITY_JOIN_AMOUNT;

    if (Number(amount) !== COMMUNITY_JOIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Community join payment must be ₹${COMMUNITY_JOIN_AMOUNT}.`,
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedPhone = normalizePhone(phone);

    // -----------------------------------------
    // 3. Check existing confirmed customer
    // -----------------------------------------

    const confirmed = await client.query(
      `
      SELECT id, email, phone
      FROM community_join_payments
      WHERE (
        LOWER(email) = $1
        OR regexp_replace(phone, '\\D', '', 'g') = $2
      )
      AND purchase_status = 'confirmed'
      LIMIT 1
      `,
      [normalizedEmail, normalizedPhone]
    );

    if (confirmed.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message:
          "This email or phone already has lifetime community access.",
      });
    }

    // -----------------------------------------
    // 4. Create purchase ID
    // -----------------------------------------

    const purchaseId =
      "CJ-" +
      Date.now() +
      "-" +
      Math.floor(Math.random() * 9999);

    // -----------------------------------------
    // 5. Create Razorpay order
    // -----------------------------------------

    const order = await createRazorpayOrder(
      finalAmount,
      "INR",
      purchaseId
    );

    console.log(
      "[community-join/create] Razorpay order created",
      {
        purchase_id: purchaseId,
        razorpay_order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }
    );

    // -----------------------------------------
    // 6. SAVE PENDING PAYMENT
    // -----------------------------------------

    const { rows } = await client.query(
      `
      INSERT INTO community_join_payments (
        purchase_id,
        name,
        email,
        phone,
        amount,
        payment_type,
        payment_status,
        purchase_status,
        razorpay_order_id,
        source,
        notes
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'pending',
        'pending_payment',
        $7,
        $8,
        $9
      )
      RETURNING *
      `,
      [
        purchaseId,
        fullName,
        normalizedEmail,
        phone.trim(),
        finalAmount,
        payment_type,
        order.id,
        source,
        notes,
      ]
    );

    console.log(
      "[community-join/create] pending payment saved",
      {
        purchase_id: rows[0].purchase_id,
        razorpay_order_id: rows[0].razorpay_order_id,
        payment_status: rows[0].payment_status,
        purchase_status: rows[0].purchase_status,
      }
    );

    // -----------------------------------------
    // 7. Return Razorpay details
    // -----------------------------------------

    return res.status(201).json({
      success: true,
      message: "Community join payment order created.",

      payment: rows[0],

      razorpayOrder: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: RAZORPAY_KEY_ID,
      },
    });
  } catch (error) {
    console.error(
      "Create Community Join Payment Error:",
      {
        message: error.message,
        statusCode: error.statusCode,
        error: error.error || null,
      }
    );

    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};
/**
 * Post-checkout verification.
 * Expects razorpayOrderId, razorpayPaymentId, razorpaySignature from Razorpay handler.
 */
const verifyCommunityJoinPayment = async (req, res) => {
  const db = await client.connect();

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    console.log("[community-join/verify] request received", {
      has_order_id: Boolean(razorpayOrderId),
      has_payment_id: Boolean(razorpayPaymentId),
      has_signature: Boolean(razorpaySignature),
      order_id: razorpayOrderId || null,
      payment_id: razorpayPaymentId || null,
    });

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message:
          "razorpayOrderId, razorpayPaymentId and razorpaySignature are required.",
      });
    }

    await db.query("BEGIN");

    const paymentResult = await db.query(
      `
      SELECT *
      FROM community_join_payments
      WHERE razorpay_order_id = $1
        AND purchase_status = 'pending_payment'
      FOR UPDATE
      `,
      [razorpayOrderId]
    );

    if (paymentResult.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Payment not found or already processed.",
      });
    }

    const payment = paymentResult.rows[0];

    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    console.log("[community-join/verify] signature check", {
      order_id: razorpayOrderId,
      valid: isValid,
    });

    if (!isValid) {
      await db.query(
        `
        UPDATE community_join_payments
        SET payment_status = 'failed',
            razorpay_payment_id = $2,
            razorpay_signature = $3,
            updated_at = NOW()
        WHERE id = $1
        `,
        [payment.id, razorpayPaymentId, razorpaySignature]
      );

      await db.query("COMMIT");

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    const { rows } = await db.query(
      `
      UPDATE community_join_payments
      SET razorpay_payment_id = $1,
          razorpay_signature = $2,
          payment_status = 'success',
          purchase_status = 'confirmed',
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [razorpayPaymentId, razorpaySignature, payment.id]
    );

    await db.query("COMMIT");

    console.log("[community-join/verify] payment confirmed", {
      purchase_id: rows[0].purchase_id,
      razorpay_order_id: rows[0].razorpay_order_id,
      payment_status: rows[0].payment_status,
      purchase_status: rows[0].purchase_status,
    });

    return res.status(200).json({
      success: true,
      message: "Payment verified. Welcome to the community!",
      payment: rows[0],
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Verify Community Join Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  } finally {
    db.release();
  }
};

/**
 * Status check for logged-in users: has this phone/email already paid?
 * Used by Just99 page to decide whether to show congratulations modal.
 */

const getCommunityJoinPaymentStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const userResult = await client.query(
      `SELECT email, phone FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const email = normalizeEmail(userResult.rows[0].email);
    const phone = normalizePhone(userResult.rows[0].phone);

    const paymentResult = await client.query(
      `
      SELECT *
      FROM community_join_payments
      WHERE purchase_status = 'confirmed'
        AND payment_status = 'success'
        AND (
          LOWER(email) = $1
          OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = $2
        )
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 1
      `,
      [email, phone]
    );

    if (paymentResult.rowCount === 0) {
      return res.status(200).json({
        success: false,
        message: "No confirmed community join payment found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified. Welcome to the community!",
      payment: paymentResult.rows[0],
    });
  } catch (error) {
    console.error("Get Community Join Payment Status Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};   

const fetchAllPayments = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const payments = await client.query(
      `
      SELECT *
      FROM community_join_payments
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );
    return res.status(200).json({
      success: true,
      message: "Payments fetched successfully.",
      payments: payments.rows,
    });
  } catch (error) {
    console.error("Fetch All Payments Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  submitJoinLead,
  createCommunityJoinPayment,
  verifyCommunityJoinPayment,
  getCommunityJoinPaymentStatus,
  fetchAllPayments,
};
