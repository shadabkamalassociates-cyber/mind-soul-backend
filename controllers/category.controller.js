const { client } = require("../cleint/client");

const createCategory = async (req, res) => {
  try {
    const { name, icon } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Category name is required.",
      });
    }

    const existing = await client.query(
      `SELECT id FROM categories WHERE LOWER(name) = LOWER($1)`,
      [name]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Category name already exists.",
      });
    }

    const { rows } = await client.query(
      `
      INSERT INTO categories (name, icon)
      VALUES ($1, $2)
      RETURNING
        id,
        name,
        icon,
        average_rating,
        total_ratings,
        created_at
      `,
      [name, icon || null]
    );

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: rows[0],
    });
  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getCategories = async (req, res) => {
  try {
    const { rows } = await client.query(
      `
      SELECT
        id,
        name,
        icon,
        average_rating,
        total_ratings,
        created_at
      FROM categories
      ORDER BY created_at DESC
      `
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await client.query(
      `
      SELECT
        id,
        name,
        icon,
        average_rating,
        total_ratings,
        created_at
      FROM categories
      WHERE id = $1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Category id is required.",
      });
    }

    if (name === undefined && icon === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const existing = await client.query(
      `SELECT id FROM categories WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found.",
      });
    }

    if (name) {
      const nameCheck = await client.query(
        `SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id != $2`,
        [name, id]
      );

      if (nameCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Category name already exists.",
        });
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    if (name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(name);
    }

    if (icon !== undefined) {
      fields.push(`icon = $${index++}`);
      values.push(icon);
    }

    values.push(id);

    const { rows } = await client.query(
      `
      UPDATE categories
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING
        id,
        name,
        icon,
        average_rating,
        total_ratings,
        created_at
      `,
      values
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: rows[0],
    });
  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteCategories = async (req, res) => {
  try {
    const { ids } = req.body;
    const { id } = req.params;

    const deleteIds = ids || (id ? [Number(id)] : null);

    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide category id or ids array.",
      });
    }

    const { rows } = await client.query(
      `
      DELETE FROM categories
      WHERE id = ANY($1::int[])
      RETURNING id
      `,
      [deleteIds]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No categories found for the given ids.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Categories deleted successfully.",
      deletedCount: rows.length,
      deletedIds: rows.map((row) => row.id),
    });
  } catch (error) {
    console.error("Delete Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategories,
};
