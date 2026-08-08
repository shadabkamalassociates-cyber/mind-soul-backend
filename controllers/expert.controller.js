const { client } = require("../cleint/client");
const { uploadToCloudinary } = require("../cleint/cloudinary");

const parseLanguages = (languages) => {
  if (languages === undefined) return undefined;
  if (!languages) return null;

  if (Array.isArray(languages)) {
    return languages.filter(Boolean);
  }

  if (typeof languages === "string") {
    try {
      const parsed = JSON.parse(languages);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean);
      }
    } catch (_) {
      // comma-separated fallback
    }

    return languages
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return null;
};

const parseCertifications = (certifications) => {
  if (certifications === undefined) return undefined;
  if (certifications === null) return null;

  if (typeof certifications === "string") {
    const trimmed = certifications.trim();
    return trimmed || null;
  }

  return String(certifications).trim() || null;
};

const isProfileCompleted = (payload) => {
  const required = [
    payload.professional_title,
    payload.profession,
    payload.about,
    payload.experience_years,
  ];

  return required.every(
    (value) =>
      value !== undefined && value !== null && String(value).trim() !== ""
  );
};

const getExperts = async (req, res) => {
  try {
    const role = req.role;

    const status = req.query.status
      ? String(req.query.status).toUpperCase()
      : null;

    const id = req.query.id
      ? String(req.query.id)
      : null;

    const allowedStatuses = ["PENDING", "VERIFIED", "REJECTED"];

    // if (status && !allowedStatuses.includes(status)) {
    //   return res.status(400).json({
    //     success: false,
    //     message: `status must be one of: ${allowedStatuses.join(", ")}`,
    //   });
    // }

    // Dynamic query parameters
    const values = [role];
    const filters = [`u.role = $1`];

    // Filter by status
    if (status) {
      values.push(status);

      filters.push(
        `COALESCE(uv.status, 'PENDING') = $${values.length}`
      );
    }

    // Filter by user/expert ID
    if (id) {
      values.push(id);

      filters.push(
        `u.id = $${values.length}`
      );
    }

    const query = `
      SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.specialization,
          u.email,
          u.phone,
          u.role,
          u.bio,
          u.experience_years,
          u.consultation_fee,
          u.profile_image,

          CASE
              WHEN ub.is_active = true THEN false
              ELSE true
          END AS is_active,

          COALESCE(uv.status, 'PENDING') AS verification_status,
          uv.reason AS verification_reason,
          uv.verified_at,
          uv.verified_by,

          CASE
              WHEN COALESCE(uv.status, 'PENDING') = 'VERIFIED'
              THEN true
              ELSE false
          END AS is_verified,

          u.average_rating,
          u.total_reviews,
          u.total_sessions,
          u.created_at,

          COALESCE(
              json_agg(
                  DISTINCT jsonb_build_object(
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
          ON c.id::text = ec.category_id::text

      LEFT JOIN LATERAL (
          SELECT
              status,
              reason,
              verified_at,
              verified_by
          FROM user_verifications
          WHERE user_id = u.id
          ORDER BY created_at DESC
          LIMIT 1
      ) uv ON TRUE

      LEFT JOIN LATERAL (
          SELECT is_active
          FROM user_blocks
          WHERE user_id = u.id
          ORDER BY created_at DESC
          LIMIT 1
      ) ub ON TRUE

      WHERE ${filters.join(" AND ")}

      GROUP BY
          u.id,
          u.first_name,
          u.last_name,
          u.specialization,
          u.email,
          u.phone,
          u.role,
          u.bio,
          u.experience_years,
          u.consultation_fee,
          u.profile_image,
          ub.is_active,
          uv.status,
          uv.reason,
          uv.verified_at,
          uv.verified_by,
          u.average_rating,
          u.total_reviews,
          u.total_sessions,
          u.created_at

      ORDER BY u.created_at DESC;
    `;

    console.log("GET EXPERTS QUERY:", query);
    console.log("QUERY VALUES:", values);

    const { rows } = await client.query(query, values);

    // If ID provided and expert doesn't exist
    if (id && rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expert not found",
      });
    }

    return res.status(200).json({
      success: true,
      count: rows.length,

      filter: {
        role,
        status: status || "ALL",
        id: id || null,
      },

      // ID means we're requesting one expert
      data: id ? rows[0] : rows,
    });

  } catch (error) {
    console.error("Get Experts Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};
const getUsersById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = req.role;
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "User id is required.",
      });
    }
    const { rows } = await client.query(
      `
      SELECT
          u.*,
          uv.id AS verification_id,
          COALESCE(uv.status, 'PENDING') AS verification_status,
          uv.reason AS verification_reason,
          uv.verified_by,
          uv.verified_at
      FROM users u
      LEFT JOIN LATERAL (
          SELECT *
          FROM user_verifications
          WHERE user_id = u.id
          ORDER BY created_at DESC
          LIMIT 1
      ) uv ON TRUE
      WHERE u.id = $1
        AND u.role = $2
      `,
      [id, role]
    );

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    console.error("Get Users By Id Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
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
      alternate_phone,
      bio,
      experience_years,
      country,
      timezone,
      consultation_fee,
      professional_title,
      profession,
      whatsapp_number,
      city,
      state,
      education,
      certifications,
      specialization,
      languages,
      about,
      why_started,
      mission,
      client_approach,
      uniqueness,
    } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Expert id is required.",
      });
    }

    const existingResult = await client.query(
      `SELECT * FROM users WHERE id = $1 AND role = 'EXPERT'`,
      [id]
    );

    if (existingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Expert not found.",
      });
    }

    const existing = existingResult.rows[0];

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

    const profileImageFile = req.files?.profile_image?.[0] || null;
    const coverImageFile = req.files?.cover_image?.[0] || null;

    const [uploadedProfileImage, uploadedCoverImage] = await Promise.all([
      uploadToCloudinary(
        profileImageFile,
        "mind-soul/expert/profile"
      ),
      uploadToCloudinary(coverImageFile, "mind-soul/expert/cover"),
    ]);

    const updates = {};

    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (alternate_phone !== undefined) updates.alternate_phone = alternate_phone;
    if (bio !== undefined) updates.bio = bio;
    if (experience_years !== undefined) {
      updates.experience_years =
        experience_years === "" || experience_years === null
          ? null
          : Number(experience_years);
    }
    if (country !== undefined) updates.country = country;
    if (timezone !== undefined) updates.timezone = timezone;
    if (consultation_fee !== undefined) {
      updates.consultation_fee =
        consultation_fee === "" || consultation_fee === null
          ? null
          : Number(consultation_fee);
    }
    if (professional_title !== undefined) {
      updates.professional_title = professional_title;
    }
    if (profession !== undefined) updates.profession = profession;
    if (whatsapp_number !== undefined) updates.whatsapp_number = whatsapp_number;
    if (city !== undefined) updates.city = city;
    if (state !== undefined) updates.state = state;
    if (education !== undefined) updates.education = education;
    if (specialization !== undefined) updates.specialization = specialization;
    if (about !== undefined) updates.about = about;
    if (why_started !== undefined) updates.why_started = why_started;
    if (mission !== undefined) updates.mission = mission;
    if (client_approach !== undefined) updates.client_approach = client_approach;
    if (uniqueness !== undefined) updates.uniqueness = uniqueness;

    if (languages !== undefined) {
      updates.languages = parseLanguages(languages);
    }

    if (certifications !== undefined) {
      updates.certifications = parseCertifications(certifications);
    }

    if (uploadedProfileImage) {
      updates.profile_image = uploadedProfileImage;
    }

    if (uploadedCoverImage) {
      updates.cover_image = uploadedCoverImage;
    }

    const mergedProfile = {
      ...existing,
      ...updates,
    };

    updates.profile_completed = isProfileCompleted(mergedProfile);

    const fields = Object.keys(updates);

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
    }

    const setClause = fields
      .map((field, index) => `${field} = $${index + 1}`)
      .join(", ");

    const values = fields.map((field) => updates[field]);
    values.push(id);

    const { rows } = await client.query(
      `
      UPDATE users
      SET
        ${setClause},
        updated_at = NOW()
      WHERE id = $${values.length}
        AND role = 'EXPERT'
      RETURNING
        id,
        first_name,
        last_name,
        email,
        phone,
        alternate_phone,
        role,
        bio,
        experience_years,
        profile_image,
        cover_image,
        country,
        timezone,
        consultation_fee,
        professional_title,
        profession,
        whatsapp_number,
        city,
        state,
        education,
        certifications,
        specialization,
        languages,
        about,
        why_started,
        mission,
        client_approach,
        uniqueness,
        profile_completed,
        average_rating,
        total_reviews,
        total_sessions,
        created_at,
        updated_at
      `,
      values
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
      message: error.message || "Internal Server Error",
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

    const normalizedIds = ids.map((id) => String(id));

    const { rows } = await client.query(
      `
      DELETE FROM users
      WHERE id::text = ANY($1::text[])
        AND role = 'EXPERT'
      RETURNING id
      `,
      [normalizedIds]
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
        const {  status, reason } = req.body;
        // console.log(req.user);
        const user_id = req.params.id;
        const verified_by =  "53752807-166a-471d-8674-e4d2c57da3a6"; 

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
  getUsersById,
  getVerifiedUsers,
  getBlockedUsers,
};
