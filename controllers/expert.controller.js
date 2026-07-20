const { client } = require("../cleint/client");

const getExperts = async (req, res) => {
  try {
    const query = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.role,
        u.bio,
        u.experience_years,
        u.consultation_fee,
        u.profile_image,
        u.average_rating,
        u.total_reviews,
        u.total_sessions,
        u.created_at,

        COALESCE(
          json_agg(
            json_build_object(
              'id', c.id,
              'name', c.name,
              'icon', c.icon
            )
          ) FILTER (WHERE c.id IS NOT NULL),
          '[]'
        ) AS categories

      FROM users u
      LEFT JOIN expert_categories ec
        ON ec.user_id = u.id
      LEFT JOIN categories c
        ON c.id = ec.category_id

      WHERE u.role = 'EXPERT'

      GROUP BY
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.role,
        u.bio,
        u.experience_years,
        u.consultation_fee,
        u.profile_image,
        u.status,
        u.verification_status,
        u.is_active,
        u.is_verified,
        u.average_rating,
        u.total_reviews,
        u.total_sessions,
        u.created_at

      ORDER BY u.created_at DESC;
    `;

    const { rows } = await client.query(query);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Experts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const updateExpert = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      first_name,
      last_name,
      email,
      phone,
      bio,
      experience_years,
      consultation_fee,
      profile_image,
      status,
      verification_status,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expert id is required.",
      });
    }

    const existing = await client.query(
      `SELECT id FROM users WHERE id = $1 AND role = 'EXPERT'`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expert not found.",
      });
    }

    if (email) {
      const emailCheck = await client.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2`,
        [email, id]
      );
      if (emailCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Email already exists.",
        });
      }
    }

    if (phone) {
      const phoneCheck = await client.query(
        `SELECT id FROM users WHERE phone = $1 AND id != $2`,
        [phone, id]
      );
      if (phoneCheck.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Phone already exists.",
        });
      }
    }

    const { rows } = await client.query(
      `
      UPDATE users
      SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        bio = COALESCE($5, bio),
        experience_years = COALESCE($6, experience_years),
        consultation_fee = COALESCE($7, consultation_fee),
        profile_image = COALESCE($8, profile_image),
        status = COALESCE($9, status),
        verification_status = COALESCE($10, verification_status)
      WHERE id = $11 AND role = 'EXPERT'
      RETURNING
        id,
        first_name,
        last_name,
        email,
        phone,
        role,
        bio,
        experience_years,
        consultation_fee,
        profile_image,
        status,
        verification_status,
        is_active,
        is_verified,
        average_rating,
        total_reviews,
        total_sessions,
        created_at
      `,
      [
        first_name,
        last_name,
        email,
        phone,
        bio,
        experience_years,
        consultation_fee,
        profile_image,
        status,
        verification_status,
        id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Expert updated successfully.",
      data: rows[0],
    });
  } catch (error) {
    console.error("Update Expert Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};

const deleteExperts = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "ids must be a non-empty array.",
      });
    }

    const { rows } = await client.query(
      `
      DELETE FROM users
      WHERE id = ANY($1::int[])
        AND role = 'EXPERT'
      RETURNING id
      `,
      [ids]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No experts found for the given ids.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Experts deleted successfully.",
      deletedCount: rows.length,
      deletedIds: rows.map((row) => row.id),
    });
  } catch (error) {
    console.error("Delete Experts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
const blockExpert = async (req, res) => {

  try {
      const { user_id, reason } = req.body;
      const blocked_by = req.user.id || "53752807-166a-471d-8674-e4d2c57da3a6"; 

      if (!user_id || !reason || reason.trim() === "") {
          return res.status(400).json({
              success: false,
              message: "User ID and block reason are required."
          });
      }


      const userResult = await client.query(
          `SELECT id, status
           FROM users
           WHERE id = $1`,
          [user_id]
      );

      if (userResult.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
              success: false,
              message: "User not found."
          });
      }

      const blockResult = await client.query(
          `SELECT id
           FROM user_blocks
           WHERE user_id = $1
           AND is_active = TRUE`,
          [user_id]
      );

      if (blockResult.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
              success: false,
              message: "Account is already blocked."
          });
      }

      await client.query(
          `INSERT INTO user_blocks
              (user_id, reason, blocked_by, is_active)
           VALUES ($1, $2, $3, TRUE)`,
          [user_id, reason.trim(), blocked_by]
      );

      await client.query("COMMIT");

      return res.status(200).json({
          success: true,
          message: "User blocked successfully."
      });

  } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);

      return res.status(500).json({
          success: false,
          message: "Internal server error."
      });
  } finally {
      client.release();
  }
};
// const verifyExpert = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { is_verified } = req.body;

//     if (!id) {
//       return res.status(400).json({
//         success: false,
//         message: "Expert id is required.",
//       });
//     }

//     if (typeof is_verified !== "boolean") {
//       return res.status(400).json({
//         success: false,
//         message: "is_verified must be a boolean.",
//       });
//     }

//     const { rows } = await client.query(
//       `
//       UPDATE users
//       SET is_verified = $1
//       WHERE id = $2 AND role = 'EXPERT'
//       RETURNING
//         id,
//         first_name,
//         last_name,
//         email,
//         phone,
//         role,
//         is_active,
//         is_verified,
//         verification_status
//       `,
//       [is_verified, id]
//     );

//     if (rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: "Expert not found.",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: is_verified
//         ? "Expert verified successfully."
//         : "Expert verification removed successfully.",
//       data: rows[0],
//     });
//   } catch (error) {
//     console.error("Verify Expert Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal Server Error",
//     });
//   }
// };

const verifyExpert = async (req, res) => {
    // const client = await client.connect();

    try {
        const { user_id, status, reason } = req.body;
        const verified_by = req.user.id || "53752807-166a-471d-8674-e4d2c57da3a6"; 

        if (!user_id || !status) {
            return res.status(400).json({
                success: false,
                message: "user_id and status are required."
            });
        }

        // if (!["VERIFIED", "REJECTED"].includes(status)) {
        //     return res.status(400).json({
        //         success: false,
        //         message: "Status must be VERIFIED or REJECTED."
        //     });
        // }

        if (status === "REJECTED" && (!reason || reason.trim() === "")) {
            return res.status(400).json({
                success: false,
                message: "Reason is required when rejecting a user."
            });
        }

        await client.query("BEGIN");

        
        const user = await client.query(
            `SELECT id FROM users WHERE id = $1`,
            [user_id]
        );

        if (user.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(404).json({
                success: false,
                message: "User not found."
            });
        }

        const verification = await client.query(
            `SELECT id
             FROM user_verifications
             WHERE user_id = $1`,
            [user_id]
        );

        if (verification.rows.length > 0) {
            // Update existing record
            await client.query(
                `UPDATE user_verifications
                 SET
                    status = $1,
                    reason = $2,
                    verified_by = $3,
                    verified_at = NOW(),
                    updated_at = NOW()
                 WHERE user_id = $4`,
                [
                    status,
                    status === "REJECTED" ? reason.trim() : null,
                    verified_by,
                    user_id,
                ]
            );
        } else {
            await client.query(
                `INSERT INTO user_verifications
                (
                    user_id,
                    status,
                    reason,
                    verified_by,
                    verified_at
                )
                VALUES ($1,$2,$3,$4,NOW())`,
                [
                    user_id,
                    status,
                    status === "REJECTED" ? reason.trim() : null,
                    verified_by,
                ]
            );
        }

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message:
                status === "VERIFIED"
                    ? "User verified successfully."
                    : "User rejected successfully."
        });

    } catch (err) {
        await client.query("ROLLBACK");
        console.error(err);

        return res.status(500).json({
            success: false,
            message: "Internal server error."
        });

    } finally {
        client.release();
    }
};


const getVerifiedUsers = async (req, res) => {
  try {
      const result = await client.query(`
          SELECT
              u.id,
              u.first_name,
              u.last_name,
              u.email,
              u.phone,
              u.profile_image,
              uv.status,
              uv.verified_at
          FROM users u
          INNER JOIN user_verifications uv
              ON u.id = uv.user_id
          WHERE uv.status = 'VERIFIED'
          ORDER BY uv.verified_at DESC
      `);

      return res.status(200).json({
          success: true,
          count: result.rowCount,
          users: result.rows
      });

  } catch (error) {
      console.error(error);

      return res.status(500).json({
          success: false,
          message: "Internal server error"
      });
  }
};


const getBlockedUsers = async (req, res) => {
  try {
      const result = await client.query(`
          SELECT
              u.id,
              u.first_name,
              u.last_name,
              u.email,
              u.phone,
              u.profile_image,
              ub.reason,
              ub.blocked_at,
              ub.blocked_by
          FROM users u
          INNER JOIN user_blocks ub
              ON u.id = ub.user_id
          WHERE ub.is_active = TRUE
          ORDER BY ub.blocked_at DESC
      `);

      return res.status(200).json({
          success: true,
          count: result.rowCount,
          users: result.rows
      });

  } catch (error) {
      console.error(error);

      return res.status(500).json({
          success: false,
          message: "Internal server error"
      });
  }
};
module.exports = {
  getExperts,
  updateExpert,
  deleteExperts,
  blockExpert,
  verifyExpert,
  getVerifiedUsers,
  getBlockedUsers,
};
