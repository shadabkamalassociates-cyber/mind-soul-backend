
const getUsers = async (req, res) => {
  try {
    const query = `
      SELECT
        id,
        first_name,
        last_name,
        email,
        phone,
        role,
        profile_image,
        status,
        verification_status,
        is_active,
        is_verified,
        average_rating,
        total_reviews,
        total_sessions,
        created_at
      FROM users
      WHERE role = 'USER'
      ORDER BY created_at DESC;
    `;

    const { rows } = await pool.query(query);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};



module.exports = {
  getUsers
};