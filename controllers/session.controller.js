const { client } = require("../cleint/client");

const SESSION_RETURN = `
  s.id,
  s.expert_id,
  s.category_id,
  s.title,
  s.description,
  s.session_type,
  s.thumbnail,
  s.video_url,
  s.meeting_link,
  s.start_time,
  s.end_time,
  s.duration_minutes,
  s.price,
  s.language,
  s.max_participants,
  s.status,
  s.created_at,
  s.updated_at,
  u.first_name AS expert_first_name,
  u.last_name AS expert_last_name,
  u.profile_image AS expert_profile_image,
  c.name AS category_name,
  c.icon AS category_icon
`;

const SESSION_JOINS = `
  FROM sessions s
  JOIN users u ON u.id = s.expert_id
  JOIN categories c ON c.id = s.category_id
`;

const validateExpertAndCategory = async (expert_id, category_id) => {
  const expertCheck = await client.query(
    `SELECT id FROM users WHERE id = $1 AND role = 'EXPERT'`,
    [expert_id]
  );

  if (expertCheck.rows.length === 0) {
    return { error: "Expert not found.", status: 404 };
  }

  const categoryCheck = await client.query(
    `SELECT id FROM categories WHERE id = $1`,
    [category_id]
  );

  if (categoryCheck.rows.length === 0) {
    return { error: "Category not found.", status: 404 };
  }

  return { error: null };
};

const createSession = async (req, res, session_type) => {
  try {
    const {
      expert_id,
      category_id,
      title,
      description,
      thumbnail,
      video_url,
      meeting_link,
      start_time,
      end_time,
      duration_minutes,
      price,
      language,
      max_participants,
      status,
    } = req.body;

    if (!expert_id || !category_id || !title) {
      return res.status(400).json({
        success: false,
        message: "expert_id, category_id and title are required.",
      });
    }

    if (session_type === "RECORDED" && !video_url) {
      return res.status(400).json({
        success: false,
        message: "video_url is required for recorded sessions.",
      });
    }

    if (session_type === "LIVE" && !meeting_link && !start_time) {
      return res.status(400).json({
        success: false,
        message: "meeting_link or start_time is required for live sessions.",
      });
    }

    const validation = await validateExpertAndCategory(expert_id, category_id);
    if (validation.error) {
      return res.status(validation.status).json({
        success: false,
        message: validation.error,
      });
    }

    const { rows } = await client.query(
      `
      INSERT INTO sessions (
        expert_id,
        category_id,
        title,
        description,
        session_type,
        thumbnail,
        video_url,
        meeting_link,
        start_time,
        end_time,
        duration_minutes,
        price,
        language,
        max_participants,
        status
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
      RETURNING *
      `,
      [
        expert_id,
        category_id,
        title,
        description || null,
        session_type,
        thumbnail || null,
        video_url || null,
        meeting_link || null,
        start_time || null,
        end_time || null,
        duration_minutes || null,
        price ?? 0,
        language || null,
        max_participants || null,
        status || "UPCOMING",
      ]
    );

    return res.status(201).json({
      success: true,
      message: `${session_type === "LIVE" ? "Live" : "Recorded"} session created successfully.`,
      data: rows[0],
    });
  } catch (error) {
    console.error(`Create ${session_type} Session Error:`, error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const createRecordedSession = (req, res) =>
  createSession(req, res, "RECORDED");

const createLiveSession = (req, res) => createSession(req, res, "LIVE");

const getAllSessions = async (req, res) => {
  try {
    const { session_type, status } = req.query;

    const filters = [];
    const values = [];
    let index = 1;

    if (session_type) {
      filters.push(`s.session_type = $${index++}`);
      values.push(session_type.toUpperCase());
    }

    if (status) {
      filters.push(`s.status = $${index++}`);
      values.push(status.toUpperCase());
    }

    const whereClause =
      filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await client.query(
      `
      SELECT ${SESSION_RETURN}
      ${SESSION_JOINS}
      ${whereClause}
      ORDER BY s.created_at DESC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get All Sessions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getSessionById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await client.query(
      `
      SELECT ${SESSION_RETURN}
      ${SESSION_JOINS}
      WHERE s.id = $1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rows[0],
    });
  } catch (error) {
    console.error("Get Session Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getSessionsByExpertId = async (req, res) => {
  try {
    const { expert_id } = req.params;
    const { session_type } = req.query;

    const values = [expert_id];
    let typeFilter = "";

    if (session_type) {
      typeFilter = `AND s.session_type = $2`;
      values.push(session_type.toUpperCase());
    }

    const { rows } = await client.query(
      `
      SELECT ${SESSION_RETURN}
      ${SESSION_JOINS}
      WHERE s.expert_id = $1
      ${typeFilter}
      ORDER BY s.created_at DESC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Sessions By Expert Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const getSessionsByCategoryId = async (req, res) => {
  try {
    const { category_id } = req.params;
    const { session_type } = req.query;

    const values = [category_id];
    let typeFilter = "";

    if (session_type) {
      typeFilter = `AND s.session_type = $2`;
      values.push(session_type.toUpperCase());
    }

    const { rows } = await client.query(
      `
      SELECT ${SESSION_RETURN}
      ${SESSION_JOINS}
      WHERE s.category_id = $1
      ${typeFilter}
      ORDER BY s.created_at DESC
      `,
      values
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Sessions By Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      title,
      description,
      thumbnail,
      video_url,
      meeting_link,
      start_time,
      end_time,
      duration_minutes,
      price,
      language,
      max_participants,
      status,
    } = req.body;

    const existing = await client.query(
      `SELECT id FROM sessions WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    if (category_id) {
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
    }

    if (status) {
      const allowedStatus = ["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"];
      if (!allowedStatus.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: `status must be one of: ${allowedStatus.join(", ")}`,
        });
      }
    }

    const fields = [];
    const values = [];
    let index = 1;

    const payload = {
      category_id,
      title,
      description,
      thumbnail,
      video_url,
      meeting_link,
      start_time,
      end_time,
      duration_minutes,
      price,
      language,
      max_participants,
      status: status ? status.toUpperCase() : undefined,
    };

    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined) {
        fields.push(`${key} = $${index++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await client.query(
      `
      UPDATE sessions
      SET ${fields.join(", ")}
      WHERE id = $${index}
      RETURNING *
      `,
      values
    );

    return res.status(200).json({
      success: true,
      message: "Session updated successfully.",
      data: rows[0],
    });
  } catch (error) {
    console.error("Update Session Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteSessions = async (req, res) => {
  try {
    const { ids } = req.body;
    const { id } = req.params;

    const deleteIds = ids || (id ? [id] : null);

    if (!Array.isArray(deleteIds) || deleteIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide session id or ids array.",
      });
    }

    const { rows } = await client.query(
      `
      DELETE FROM sessions
      WHERE id = ANY($1::uuid[])
      RETURNING id
      `,
      [deleteIds]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No sessions found for the given ids.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Sessions deleted successfully.",
      deletedCount: rows.length,
      deletedIds: rows.map((row) => row.id),
    });
  } catch (error) {
    console.error("Delete Sessions Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

module.exports = {
  createRecordedSession,
  createLiveSession,
  getAllSessions,
  getSessionById,
  getSessionsByExpertId,
  getSessionsByCategoryId,
  updateSession,
  deleteSessions,
};
