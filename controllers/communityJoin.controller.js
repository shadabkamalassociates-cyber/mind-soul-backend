const { client } = require("../cleint/client");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  RAZORPAY_KEY_ID,
} = require("../utils/razorpay");

const COMMUNITY_JOIN_AMOUNT = 1;

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
      email,
      phone,
      payment_type = "full",
      amount = COMMUNITY_JOIN_AMOUNT,
      notes = null,
      source = "website_popup",
    } = req.body;

    if (!name?.trim() || !email?.trim() || !phone?.trim()) {
      return res.status(400).json({
        success: false,
        message: "name, email and phone are required.",
      });
    }

    const finalAmount = COMMUNITY_JOIN_AMOUNT;
    console.log("finalAmount++++++++++++++++", finalAmount,COMMUNITY_JOIN_AMOUNT);
    if (Number(amount) === COMMUNITY_JOIN_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Community join payment must be ₹${COMMUNITY_JOIN_AMOUNT}.`,
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const confirmed = await client.query(
      `
      SELECT id
      FROM community_join_payments
      WHERE LOWER(email) = $1
        AND purchase_status = 'confirmed'
      LIMIT 1
      `,
      [normalizedEmail]
    );
    if(confirmed.phone === phone.trim()){
      return res.status(400).json({
        success: false,
        message: "This phone number already has lifetime community access.",
      });
    }
    if (confirmed.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "This email already has lifetime community access.",
      });
    }

    // Reuse an existing pending order for this email so retries don't create duplicates.
    const pending = await client.query(
      `
      SELECT *
      FROM community_join_payments
      WHERE LOWER(email) = $1
        AND purchase_status = 'pending_payment'
        AND payment_status = 'pending'
        AND razorpay_order_id IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [normalizedEmail]
    );

    if (pending.rowCount > 0) {
      const payment = pending.rows[0];
      const pendingAmount = Number(payment.amount) || finalAmount;

      return res.status(200).json({
        success: true,
        message: "Existing community join payment order reused.",
        payment,
        razorpayOrder: {
          id: payment.razorpay_order_id,
          amount: Math.round(pendingAmount * 100),
          currency: "INR",
          key: RAZORPAY_KEY_ID,
        },
      });
    }

    const purchaseId =
      "CJ-" + Date.now() + "-" + Math.floor(Math.random() * 9999);

    const order = await createRazorpayOrder(finalAmount, "INR", purchaseId);

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
      VALUES ($1, $2, $3, $4, $5, $6, 'pending', 'pending_payment', $7, $8, $9)
      RETURNING *
      `,
      [
        purchaseId,
        name.trim(),
        normalizedEmail,
        phone.trim(),
        finalAmount,
        payment_type,
        order.id,
        source,
        notes,
      ]
    );

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
    console.error("Create Community Join Payment Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

const verifyCommunityJoinPayment = async (req, res) => {
  const db = await client.connect();

  try {
    console.log("|||||||||||||||||||||||||||||||", req.user);
    const user =  req.user.id;

    const userPhone = await db.query(
      `
      SELECT *
      FROM users
      WHERE id = $1`,
      [user]
    );

    // if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    //   return res.status(400).json({
    //     success: false,
    //     message:
    //       "razorpayOrderId, razorpayPaymentId and razorpaySignature are required.",
    //   });
    // }

    await db.query("BEGIN");

    const paymentResult = await db.query(
      `
      SELECT *
      FROM community_join_payments
      WHERE phone = $1
      FOR UPDATE
      `,
      [ userPhone.rows[0].phone]
    );

    if (paymentResult.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Payment not found or already processed.",
      });
    }


    const payment = paymentResult.rows[0];
    console.log("payment++++++++++++++++", payment);
    if (!payment?.razorpay_order_id || !payment?.razorpay_payment_id || !payment?.razorpay_signature) {
      return res.status(200).json({
        success: false,
        message: "We have not received the payment yet. Please wait for the payment to be received."
      });
    }
    const isValid = verifyPaymentSignature(
      payment?.razorpay_order_id,
      payment?.razorpay_payment_id,
      payment?.razorpay_signature
    );
    console.log("isValid++++++++++++++++", isValid);
    if (!isValid) {
      await db.query(
        `
        UPDATE community_join_payments
        SET payment_status = 'failed',
            updated_at = NOW()
        WHERE id = $1
        `,
        [payment.id]
      );

      await db.query("COMMIT");

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    

    await db.query("COMMIT");

    return res.status(200).json({
      success: isValid,
      message: "Payment verified. Welcome to the community!",
      payment: payment,
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
      [ limit, offset]
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
      message: error.message || "Internal Server Error",
    });
  }
};
module.exports = {
  submitJoinLead,
  createCommunityJoinPayment,
  verifyCommunityJoinPayment,
  fetchAllPayments,
};
