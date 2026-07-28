  const { client } = require("../cleint/client");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
} = require("../utils/razorpay");

const createSessionPurchase = async (req, res) => {
  try {
    const {
      session_id,
      payment_type = "full",
      quantity = 1,
      coupon_code = null,
      notes = null,
    } = req.body;

    const user_id = req.user.id;

    const sessionResult = await client.query(
      `SELECT
        id,
        expert_id,
        title,
        price,
        discount_price,
        session_type,
        status
      FROM sessions
      WHERE id = $1`,
      [session_id]
    );

    if (sessionResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Session not found",
      });
    }

    const session = sessionResult.rows[0];

    if (session.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Session is not available",
      });
    }

    const existingPurchase = await client.query(
      `SELECT id
       FROM session_purchases
       WHERE session_id = $1
         AND user_id = $2
         AND purchase_status IN ('confirmed', 'pending_payment')`,
      [session_id, user_id]
    );

    if (existingPurchase.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "You have already purchased this session.",
      });
    }

    const sessionPrice = Number(session.discount_price || session.price);
    const amountBeforeDiscount = sessionPrice * quantity;
    const discountAmount = 0;
    const taxableAmount = amountBeforeDiscount - discountAmount;
    const taxAmount = 0;
    const processingFee = Number((taxableAmount * 0.02).toFixed(2));
    const finalAmount = taxableAmount + taxAmount + processingFee;

    let razorpayAmount = finalAmount;
    let amountPaid = finalAmount;
    let remainingAmount = 0;

    if (payment_type === "partial") {
      razorpayAmount = 1000;
      amountPaid = 1000;
      remainingAmount = finalAmount - 1000;
    }

    const purchaseId =
      "PUR-" + Date.now() + "-" + Math.floor(Math.random() * 9999);

    const order = await createRazorpayOrder(
      razorpayAmount,
      "INR",
      purchaseId
    );

    const purchase = await client.query(
      `
      INSERT INTO session_purchases
      (
        purchase_id,
        session_id,
        user_id,
        expert_id,
        quantity,
        payment_type,
        payment_status,
        purchase_status,
        amount_before_discount,
        discount_amount,
        tax_amount,
        processing_fee,
        final_amount,
        amount_paid,
        remaining_amount,
        razorpay_order_id,
        coupon_code,
        notes
      )
      VALUES
      (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,
        $16,$17,$18
      )
      RETURNING *
      `,
      [
        purchaseId,
        session.id,
        user_id,
        session.expert_id,
        quantity,
        payment_type,
        "pending",
        "pending_payment",
        amountBeforeDiscount,
        discountAmount,
        taxAmount,
        processingFee,
        finalAmount,
        amountPaid,
        remainingAmount,
        order.id,
        coupon_code,
        notes,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      purchase: purchase.rows[0],
      razorpayOrder: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
      amountBreakdown: {
        amountBeforeDiscount,
        discountAmount,
        taxAmount,
        processingFee,
        totalAmount: finalAmount,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

const verifyPayment = async (req, res) => {
  const db = await client.connect();

  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const user_id = req.user.id;

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        success: false,
        message:
          "razorpayOrderId, razorpayPaymentId and razorpaySignature are required.",
      });
    }

    await db.query("BEGIN");

    const purchaseResult = await db.query(
      `SELECT *
       FROM session_purchases
       WHERE razorpay_order_id = $1
         AND user_id = $2
         AND purchase_status = 'pending_payment'
       FOR UPDATE`,
      [razorpayOrderId, user_id]
    );

    if (purchaseResult.rowCount === 0) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Purchase not found or already processed.",
      });
    }

    const purchase = purchaseResult.rows[0];

    const isValid = verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      await db.query(
        `UPDATE session_purchases
         SET payment_status = 'failed'
         WHERE id = $1`,
        [purchase.id]
      );

      await db.query("COMMIT");

      return res.status(400).json({
        success: false,
        message: "Invalid payment signature.",
      });
    }

    const purchaseStatus =
      purchase.payment_type === "partial" ? "partially_paid" : "confirmed";

    const updatedPurchase = await db.query(
      `UPDATE session_purchases
       SET razorpay_payment_id = $1,
           razorpay_signature = $2,
           payment_status = 'success',
           purchase_status = $3
       WHERE id = $4
       RETURNING *`,
      [razorpayPaymentId, razorpaySignature, purchaseStatus, purchase.id]
    );

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Payment verified and purchase confirmed.",
      purchase: updatedPurchase.rows[0],
    });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Payment verification error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  } finally {
    db.release();
  }
};

module.exports = { createSessionPurchase, verifyPayment };
