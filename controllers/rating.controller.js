const { client } = require("../cleint/client");

const refreshCategoryStats = async (categoryId) => {
  await client.query(
    `
    UPDATE categories
    SET
      average_rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 2)
        FROM category_ratings
        WHERE category_id = $1
      ), 0.00),
      total_ratings = (
        SELECT COUNT(*)::int
        FROM category_ratings
        WHERE category_id = $1
      )
    WHERE id = $1
    `,
    [categoryId]
  );
};

const createOrUpdateRating = async (req, res) => {
  try {
    const { user_id, category_id, rating, review } = req.body;

    if (!user_id || !category_id || rating === undefined) {
      return res.status(400).json({
        success: false,
        message: "user_id, category_id and rating are required.",
      });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "rating must be an integer between 1 and 5.",
      });
    }

    const categoryCheck = await client.query(
      `SELECT id FROM categories WHERE id = $1`,
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const userCheck = await client.query(
      `SELECT id FROM users WHERE id = $1`,
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const { rows } = await client.query(
      `
      INSERT INTO category_ratings (user_id, category_id, rating, review)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, category_id)
      DO UPDATE SET
        rating = EXCLUDED.rating,
        review = EXCLUDED.review,
        updated_at = CURRENT_TIMESTAMP
      RETURNING
        id,
        user_id,
        category_id,
        rating,
        review,
        created_at,
        updated_at
      `,
      [user_id, category_id, rating, review || null]
    );

    await refreshCategoryStats(category_id);

    const category = await client.query(
      `
      SELECT id, name, average_rating, total_ratings
      FROM categories
      WHERE id = $1
      `,
      [category_id]
    );

    return res.status(200).json({
      success: true,
      message: "Rating saved successfully.",
      data: rows[0],
      category: category.rows[0],
    });
  } catch (error) {
    console.error("Create/Update Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateRating = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, review } = req.body;

    if (rating === undefined && review === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide rating or review to update.",
      });
    }

    if (
      rating !== undefined &&
      (!Number.isInteger(rating) || rating < 1 || rating > 5)
    ) {
      return res.status(400).json({
        success: false,
        message: "rating must be an integer between 1 and 5.",
      });
    }

    const existing = await client.query(
      `SELECT id, category_id FROM category_ratings WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found.",
      });
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (rating !== undefined) {
      fields.push(`rating = $${index++}`);
      values.push(rating);
    }

    if (review !== undefined) {
      fields.push(`review = $${index++}`);
      values.push(review);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const { rows } = await client.query(
      `
      UPDATE category_ratings
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        user_id,
        category_id,
        rating,
        review,
        created_at,
        updated_at
      `,
      values
    );

    await refreshCategoryStats(existing.rows[0].category_id);

    return res.status(200).json({
      success: true,
      message: "Rating updated successfully.",
      data: rows[0],
    });
  } catch (error) {
    console.error("Update Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteRating = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await client.query(
      `
      DELETE FROM category_ratings
      WHERE id = $1
      RETURNING id, category_id
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found.",
      });
    }

    await refreshCategoryStats(rows[0].category_id);

    return res.status(200).json({
      success: true,
      message: "Rating deleted successfully.",
      deletedId: rows[0].id,
    });
  } catch (error) {
    console.error("Delete Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getRatingsByCategory = async (req, res) => {
  try {
    const { category_id } = req.params;

    const categoryCheck = await client.query(
      `SELECT id, name, average_rating, total_ratings FROM categories WHERE id = $1`,
      [category_id]
    );

    if (categoryCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    const { rows } = await client.query(
      `
      SELECT
        cr.id,
        cr.user_id,
        cr.category_id,
        cr.rating,
        cr.review,
        cr.created_at,
        cr.updated_at,
        u.first_name,
        u.last_name,
        u.profile_image
      FROM category_ratings cr
      JOIN users u ON u.id = cr.user_id
      WHERE cr.category_id = $1
      ORDER BY cr.created_at DESC
      `,
      [category_id]
    );

    return res.status(200).json({
      success: true,
      category: categoryCheck.rows[0],
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Ratings Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getUserCategoryRating = async (req, res) => {
  try {
    const { user_id, category_id } = req.params;

    const { rows } = await client.query(
      `
      SELECT
        id,
        user_id,
        category_id,
        rating,
        review,
        created_at,
        updated_at
      FROM category_ratings
      WHERE user_id = $1 AND category_id = $2
      `,
      [user_id, category_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Rating not found for this user and category.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get User Category Rating Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  createOrUpdateRating,
  updateRating,
  deleteRating,
  getRatingsByCategory,
  getUserCategoryRating,
};
