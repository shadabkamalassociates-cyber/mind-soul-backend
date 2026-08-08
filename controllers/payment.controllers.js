const { client } = require("../cleint/client");
const crypto = require("crypto");

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const roundMoney = (value) => Math.round(toNumber(value) * 100) / 100;

const getOrCreateActiveCart = async (db, userId) => {
  const existing = await db.query(
    `
    SELECT *
    FROM carts
    WHERE user_id = $1
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (existing.rows.length) {
    return existing.rows[0];
  }

  const created = await db.query(
    `
    INSERT INTO carts (user_id, status)
    VALUES ($1, 'ACTIVE')
    RETURNING *
    `,
    [userId]
  );

  return created.rows[0];
};

const recalculateCartTotals = async (db, cartId, extras = {}) => {
  const itemsResult = await db.query(
    `
    SELECT
      COALESCE(SUM(final_price), 0) AS subtotal,
      COALESCE(SUM(discount), 0) AS item_discount
    FROM cart_items
    WHERE cart_id = $1
    `,
    [cartId]
  );

  const subtotal = roundMoney(itemsResult.rows[0].subtotal);
  const itemDiscount = roundMoney(itemsResult.rows[0].item_discount);
  const cartDiscount =
    extras.discount !== undefined
      ? roundMoney(extras.discount)
      : roundMoney(itemDiscount);
  const tax =
    extras.tax !== undefined
      ? roundMoney(extras.tax)
      : 0;
  const total = roundMoney(Math.max(subtotal - (extras.discount !== undefined ? cartDiscount : 0) + tax, 0));

  // When cart-level discount is not explicitly passed, subtotal already has item discounts applied via final_price
  const computedTotal =
    extras.discount !== undefined || extras.tax !== undefined
      ? roundMoney(Math.max(subtotal - (extras.discount !== undefined ? cartDiscount : 0) + tax, 0))
      : subtotal;

  const { rows } = await db.query(
    `
    UPDATE carts
    SET
      subtotal = $1,
      discount = $2,
      tax = $3,
      total = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING *
    `,
    [
      subtotal,
      extras.discount !== undefined ? cartDiscount : itemDiscount,
      tax,
      computedTotal,
      cartId,
    ]
  );

  return rows[0];
};

const getCartWithItems = async (db, cartId) => {
  const cartResult = await db.query(
    `SELECT * FROM carts WHERE id = $1`,
    [cartId]
  );

  if (!cartResult.rows.length) {
    return null;
  }

  const itemsResult = await db.query(
    `
    SELECT
      ci.id,
      ci.cart_id,
      ci.session_id,
      ci.quantity,
      ci.unit_price,
      ci.discount,
      ci.final_price,
      ci.metadata,
      ci.created_at,
      s.title,
      s.description,
      s.session_type,
      s.thumbnail,
      s.price AS session_price,
      s.status AS session_status,
      s.start_time,
      s.end_time,
      s.duration_minutes,
      s.language,
      c.name AS category_name,
      u.first_name AS expert_first_name,
      u.last_name AS expert_last_name,
      u.profile_image AS expert_profile_image
    FROM cart_items ci
    JOIN sessions s ON s.id = ci.session_id
    JOIN categories c ON c.id = s.category_id
    JOIN users u ON u.id = s.expert_id
    WHERE ci.cart_id = $1
    ORDER BY ci.created_at DESC
    `,
    [cartId]
  );

  return {
    ...cartResult.rows[0],
    items: itemsResult.rows,
    item_count: itemsResult.rows.length,
  };
};

const addToCart = async (req, res) => {
  const db = await client.connect();

  try {
    const userId = req.user.id;
    const { session_id, quantity = 1, discount = 0, metadata = null } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "session_id is required.",
      });
    }

    const qty = Math.max(1, parseInt(quantity, 10) || 1);
    const itemDiscount = roundMoney(discount);

    const sessionResult = await db.query(
      `
      SELECT id, price, title, status
      FROM sessions
      WHERE id = $1
      `,
      [session_id]
    );

    if (!sessionResult.rows.length) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    const session = sessionResult.rows[0];

    if (session.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        message: "Cannot add a cancelled session to cart.",
      });
    }

    const alreadyPurchased = await db.query(
      `
      SELECT id
      FROM session_purchases
      WHERE session_id = $1
        AND user_id = $2
        AND payment_status = 'SUCCESS'
      `,
      [session_id, userId]
    );

    if (alreadyPurchased.rows.length) {
      return res.status(409).json({
        success: false,
        message: "You already purchased this session.",
      });
    }

    await db.query("BEGIN");

    const cart = await getOrCreateActiveCart(db, userId);
    const unitPrice = roundMoney(session.price);
    const finalPrice = roundMoney(Math.max(unitPrice * qty - itemDiscount, 0));

    const itemResult = await db.query(
      `
      INSERT INTO cart_items
      (
        cart_id,
        user_id,
        session_id,
        quantity,
        unit_price,
        discount,
        final_price,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (cart_id, session_id)
      DO UPDATE SET
        quantity = EXCLUDED.quantity,
        unit_price = EXCLUDED.unit_price,
        discount = EXCLUDED.discount,
        final_price = EXCLUDED.final_price,
        metadata = COALESCE(EXCLUDED.metadata, cart_items.metadata)
      RETURNING *
      `,
      [
        cart.id,
        userId,
        session_id,
        qty,
        unitPrice,
        itemDiscount,
        finalPrice,
        metadata,
      ]
    );

    await recalculateCartTotals(db, cart.id);
    const fullCart = await getCartWithItems(db, cart.id);

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Session added to cart.",
      data: {
        cart: fullCart,
        item: itemResult.rows[0],
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Add To Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    db.release();
  }
};


const getCart = async (req, res) => {
  try {
    // You can take user_id from query:
    // GET /cart?user_id=<uuid>
    const user_id = req.user.id;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        message: "user_id is required",
      });
    }

    const query = `
      SELECT
        c.id,
        c.user_id,
        c.subtotal,
        c.discount,
        c.tax,
        c.total,
        c.status,
        c.created_at,
        c.updated_at,

        COALESCE(
          jsonb_agg(
            jsonb_build_object(

              'cart_item_id', ci.id,
              'quantity', ci.quantity,
              'unit_price', ci.unit_price,
              'discount', ci.discount,
              'final_price', ci.final_price,
              'metadata', ci.metadata,
              'created_at', ci.created_at,

              'session',
              jsonb_build_object(
                'id', s.id,
                'expert_id', s.expert_id,
                'title', s.title,
                'description', s.description,
                'session_type', s.session_type,
                'thumbnail', s.thumbnail,
                'video_url', s.video_url,
                'meeting_link', s.meeting_link,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'duration_minutes', s.duration_minutes,
                'price', s.price,
                'language', s.language,
                'max_participants', s.max_participants,
                'status', s.status,
                'is_published', s.is_published,
                'created_at', s.created_at,
                'updated_at', s.updated_at
              )
            )
            ORDER BY ci.created_at DESC
          ) FILTER (WHERE ci.id IS NOT NULL),
          '[]'::jsonb
        ) AS items

      FROM carts c

      LEFT JOIN cart_items ci
        ON ci.cart_id = c.id

      LEFT JOIN sessions s
        ON s.id = ci.session_id

      WHERE c.user_id = $1
        AND c.status = 'ACTIVE'

      GROUP BY c.id

      ORDER BY c.created_at DESC

      LIMIT 1
    `;

    console.log("Fetching cart for user:", user_id);

    const { rows } = await client.query(query, [user_id]);

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Cart is empty",
        data: null,
      });
    }

    return res.status(200).json({
      success: true,
      itemCount: rows[0].items.length,
      data: rows[0],
    });

  } catch (error) {
    console.error("Get User Cart Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};




// const getCart = async (req, res) => {
//   try {
//     const userId =  "507fb954-65b8-4aa0-87a5-97df36d5926f";
//     const cart = await getOrCreateActiveCart(client, userId);
//     const fullCart = await getCartWithItems(client, cart.id);

//     return res.status(200).json({
//       success: true,
//       data: fullCart,
//     });
//   } catch (error) {
//     console.error("Get Cart Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

const updateCartItem = async (req, res) => {
  const db = await client.connect();

  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { quantity, discount, metadata } = req.body;

    if (quantity === undefined && discount === undefined && metadata === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide quantity, discount, or metadata to update.",
      });
    }

    await db.query("BEGIN");

    const itemResult = await db.query(
      `
      SELECT ci.*, c.user_id, c.status AS cart_status
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      WHERE ci.id = $1
      `,
      [id]
    );

    if (!itemResult.rows.length) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Cart item not found.",
      });
    }

    const item = itemResult.rows[0];

    if (item.user_id !== userId) {
      await db.query("ROLLBACK");
      return res.status(403).json({
        success: false,
        message: "Not allowed to update this cart item.",
      });
    }

    if (item.cart_status !== "ACTIVE") {
      await db.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only active cart items can be updated.",
      });
    }

    // quantity 0 => remove item
    if (quantity !== undefined && Number(quantity) <= 0) {
      await db.query(`DELETE FROM cart_items WHERE id = $1`, [id]);
      await recalculateCartTotals(db, item.cart_id);
      const fullCart = await getCartWithItems(db, item.cart_id);
      await db.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Cart item removed.",
        data: fullCart,
      });
    }

    const qty =
      quantity !== undefined
        ? Math.max(1, parseInt(quantity, 10) || 1)
        : item.quantity;
    const itemDiscount =
      discount !== undefined ? roundMoney(discount) : roundMoney(item.discount);
    const unitPrice = roundMoney(item.unit_price);
    const finalPrice = roundMoney(Math.max(unitPrice * qty - itemDiscount, 0));

    const updated = await db.query(
      `
      UPDATE cart_items
      SET
        quantity = $1,
        discount = $2,
        final_price = $3,
        metadata = COALESCE($4, metadata)
      WHERE id = $5
      RETURNING *
      `,
      [qty, itemDiscount, finalPrice, metadata ?? null, id]
    );

    await recalculateCartTotals(db, item.cart_id);
    const fullCart = await getCartWithItems(db, item.cart_id);

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Cart item updated.",
      data: {
        cart: fullCart,
        item: updated.rows[0],
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Update Cart Item Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    db.release();
  }
};

const removePurchasedSessionFromCart = async (db, userId, sessionId) => {
  const cartResult = await db.query(
    `
    SELECT id
    FROM carts
    WHERE user_id = $1
      AND status = 'ACTIVE'
    ORDER BY created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  if (!cartResult.rows.length) return;

  const cartId = cartResult.rows[0].id;

  await db.query(
    `DELETE FROM cart_items WHERE cart_id = $1 AND session_id = $2`,
    [cartId, sessionId]
  );

  await recalculateCartTotals(db, cartId);
};

const clearCart = async (req, res) => {
  const db = await client.connect();

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Token required.",
      });
    }

    await db.query("BEGIN");

    const cartResult = await db.query(
      `
      SELECT *
      FROM carts
      WHERE user_id = $1
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [userId]
    );

    if (!cartResult.rows.length) {
      await db.query("COMMIT");
      return res.status(200).json({
        success: true,
        message: "Cart is already empty.",
        data: null,
      });
    }

    const cart = cartResult.rows[0];

    await db.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cart.id]);

    const updatedCart = await db.query(
      `
      UPDATE carts
      SET
        subtotal = 0,
        discount = 0,
        tax = 0,
        total = 0,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [cart.id]
    );

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Cart cleared successfully.",
      data: {
        ...updatedCart.rows[0],
        items: [],
        item_count: 0,
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Clear Cart Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    db.release();
  }
};

const checkout = async (req, res) => {
  const db = await client.connect();

  try {
    const userId = req.user.id;
    const {
      payment_id = null,
      discount,
      tax = 0,
      payment_status = "SUCCESS",
    } = req.body;

    const allowedPaymentStatus = ["PENDING", "SUCCESS", "FAILED"];
    const finalPaymentStatus = String(payment_status).toUpperCase();

    if (!allowedPaymentStatus.includes(finalPaymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `payment_status must be one of: ${allowedPaymentStatus.join(", ")}`,
      });
    }

    await db.query("BEGIN");

    const cartResult = await db.query(
      `
      SELECT *
      FROM carts
      WHERE user_id = $1
        AND status = 'ACTIVE'
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (!cartResult.rows.length) {
      await db.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "No active cart found.",
      });
    }

    const cart = cartResult.rows[0];

    const itemsResult = await db.query(
      `
      SELECT *
      FROM cart_items
      WHERE cart_id = $1
      `,
      [cart.id]
    );

    if (!itemsResult.rows.length) {
      await db.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cart is empty.",
      });
    }

    const updatedCart = await recalculateCartTotals(db, cart.id, {
      discount,
      tax,
    });

    const paymentId = payment_id || crypto.randomUUID();
    const purchases = [];

    for (const item of itemsResult.rows) {
      const purchaseResult = await db.query(
        `
        INSERT INTO session_purchases
        (
          session_id,
          user_id,
          payment_id,
          amount,
          payment_status,
          access_status,
          purchased_at
        )
        VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())
        ON CONFLICT (session_id, user_id)
        DO UPDATE SET
          payment_id = EXCLUDED.payment_id,
          amount = EXCLUDED.amount,
          payment_status = EXCLUDED.payment_status,
          access_status = 'ACTIVE',
          purchased_at = NOW()
        RETURNING *
        `,
        [
          item.session_id,
          userId,
          paymentId,
          item.final_price,
          finalPaymentStatus,
        ]
      );

      purchases.push(purchaseResult.rows[0]);
    }

    const checkedOutCart = await db.query(
      `
      UPDATE carts
      SET
        status = 'CHECKED_OUT',
        subtotal = $1,
        discount = $2,
        tax = $3,
        total = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
      `,
      [
        updatedCart.subtotal,
        updatedCart.discount,
        updatedCart.tax,
        updatedCart.total,
        cart.id,
      ]
    );

    await db.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Checkout completed successfully.",
      data: {
        cart: checkedOutCart.rows[0],
        payment_id: paymentId,
        purchases,
      },
    });
  } catch (error) {
    await db.query("ROLLBACK");
    console.error("Checkout Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  } finally {
    db.release();
  }
};

const getMyPurchases = async (req, res) => {
  try {
    const userId = req.user.id;
    const { payment_status } = req.query;

    const values = [userId];
    let statusFilter = "";

    if (payment_status) {
      values.push(String(payment_status).toUpperCase());
      statusFilter = `AND sp.payment_status = $2`;
    }

    const { rows } = await client.query(
      `
      SELECT
        sp.id,
        sp.session_id,
        sp.user_id,
        sp.payment_id,
        sp.amount,
        sp.payment_status,
        sp.purchase_status,
        sp.access_status,
        sp.purchased_at,
        s.title,
        s.description,
        s.session_type,
        s.thumbnail,
        s.video_url,
        s.meeting_link,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.language,
        s.status AS session_status,
        c.name AS category_name,
        u.first_name AS expert_first_name,
        u.last_name AS expert_last_name,
        u.profile_image AS expert_profile_image
      FROM session_purchases sp
      JOIN sessions s ON s.id = sp.session_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = s.expert_id
      WHERE sp.user_id = $1
      ${statusFilter}
      ORDER BY sp.purchased_at DESC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get My Purchases Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getPurchaseDetails = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { rows } = await client.query(
      `
      SELECT
        sp.id,
        sp.session_id,
        sp.user_id,
        sp.payment_id,
        sp.amount,
        sp.payment_status,
        sp.purchase_status,
        sp.access_status,
        sp.purchased_at,
        s.title,
        s.description,
        s.session_type,
        s.thumbnail,
        s.video_url,
        s.meeting_link,
        s.start_time,
        s.end_time,
        s.duration_minutes,
        s.language,
        s.price AS session_price,
        s.status AS session_status,
        c.id AS category_id,
        c.name AS category_name,
        u.id AS expert_id,
        u.first_name AS expert_first_name,
        u.last_name AS expert_last_name,
        u.profile_image AS expert_profile_image,
        u.professional_title AS expert_title
      FROM session_purchases sp
      JOIN sessions s ON s.id = sp.session_id
      JOIN categories c ON c.id = s.category_id
      JOIN users u ON u.id = s.expert_id
      WHERE sp.id = $1
        AND sp.user_id = $2
      `,
      [id, userId]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Purchase not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get Purchase Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  clearCart,
  removePurchasedSessionFromCart,
  checkout,
  getMyPurchases,
  getPurchaseDetails,
};
