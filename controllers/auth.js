const bcrypt = require("bcrypt");
const https = require("https");
const { client } = require("../cleint/client");
const { generateToken } = require("./common/generateToken");
const {
  uploadToCloudinary,
} = require("../cleint/cloudinary");

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const WHATSAPP_OTP_WEBHOOK_ID =
  process.env.WHATSAPP_OTP_WEBHOOK_ID || "1321910100997854";
const WHATSAPP_OTP_TEMPLATE_NAME =
  process.env.WHATSAPP_OTP_TEMPLATE_NAME || "otp_msg";
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

const otpStore = new Map();

const normalizePhone = (phone) => {
  const digits = String(phone).replace(/\D/g, "");

  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);

  return digits;
};

const formatWhatsAppRecipient = (mobileNumber) => {
  const digits = String(mobileNumber || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
};

const postWhatsAppJson = (url, payload, token) =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const parsed = new URL(url);

    const request = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Content-Length": Buffer.byteLength(body),
          Authorization: `Bearer ${String(token).trim()}`,
        },
      },
      (response) => {
        let raw = "";
        response.on("data", (chunk) => {
          raw += chunk;
        });
        response.on("end", () => {
          let data = raw;
          try {
            data = raw ? JSON.parse(raw) : {};
          } catch (_) {
            data = { message: raw };
          }
          resolve({ status: response.statusCode || 500, data });
        });
      }
    );

    request.on("error", reject);
    request.setTimeout(15000, () => {
      request.destroy(new Error("WhatsApp API request timed out."));
    });
    request.write(body);
    request.end();
  });

const getWhatsAppErrorMessage = (data, fallback) =>
  data?.error?.message ||
  data?.error?.error_user_msg ||
  (typeof data?.message === "string" ? data.message : null) ||
  data?.error_message ||
  (typeof data?.error === "string" ? data.error : null) ||
  fallback ||
  "Failed to send OTP via WhatsApp.";

const sendOtpViaWhatsApp = async (mobileNumber, otp, first_name) => {
  if (!WHATSAPP_ACCESS_TOKEN) {
    const error = new Error("WHATSAPP_ACCESS_TOKEN is not configured.");
    error.statusCode = 500;
    throw error;
  }

  const to = String(formatWhatsAppRecipient(mobileNumber));
  const otpText = String(otp);
  const whatsappUrl = `https://crmapi1.whatapi.in/api/meta/v19.0/${WHATSAPP_OTP_WEBHOOK_ID}/messages`;

  const payload = {
    to,
    recipient_type: "individual",
    type: "template",
    template: {
      language: {
        policy: "deterministic",
        code: "en_GB",
      },
      name: WHATSAPP_OTP_TEMPLATE_NAME,
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: first_name },
            { type: "text", text:`Your OTP is ${otpText}` },
            { type: "text", text: "This OTP is valid for 10 minutes" },
            { type: "text", text: "Do not share this OTP with anyone." },
            { type: "text", text: "Please use this OTP to verify your account." },
          ],
        },
      ],
    },
  };

  const { status, data } = await postWhatsAppJson(
    whatsappUrl,
    payload,
    WHATSAPP_ACCESS_TOKEN
  );

  const messageStatus = String(
    data?.message?.message_status || data?.message_status || ""
  ).toLowerCase();
  const queuedOk = ["queued", "sent", "delivered", "accepted", "success"].includes(
    messageStatus
  );
  const apiFailed =
    status >= 400 ||
    data?.success === false ||
    messageStatus === "failed" ||
    Boolean(data?.error);

  if (apiFailed || !queuedOk) {
    const error = new Error(getWhatsAppErrorMessage(data, "WhatsApp did not accept the OTP message."));
    error.statusCode = status >= 400 ? status : 502;
    error.details = data;
    throw error;
  }

  return data;
};

const parseLanguages = (languages) => {
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
  if (certifications === undefined || certifications === null) {
    return null;
  }

  if (typeof certifications === "string") {
    const trimmed = certifications.trim();
    return trimmed || null;
  }

  return String(certifications).trim() || null;
};

const isProfileCompleted = (payload, role) => {
  if (role !== "EXPERT") {
    return false;
  }

  const required = [
    payload.professional_title,
    payload.profession,
    payload.about,
    payload.experience_years,
  ];

  return required.every((value) => value !== undefined && value !== null && String(value).trim() !== "");
};

const register = async (req, res) => {
  const db = await client.connect();
  const role = req.role;

  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      alternate_phone,
      password,
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

    if (!first_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "First name, email and password are required.",
      });
    }

    const emailCheck = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (emailCheck.rows.length) {
      return res.status(400).json({
        success: false,
        message: "Email already exists.",
      });
    }

    if (phone) {
      const phoneCheck = await db.query(
        "SELECT id FROM users WHERE phone = $1",
        [phone]
      );

      if (phoneCheck.rows.length) {
        return res.status(400).json({
          success: false,
          message: "Phone already exists.",
        });
      }
    }

    // Upload profile/cover images to Cloudinary when present
    const profileImageFile = req.files?.profile_image?.[0] || null;
    const coverImageFile = req.files?.cover_image?.[0] || null;

    const [profile_image, cover_image] = await Promise.all([
      uploadToCloudinary(profileImageFile, `mind-soul/${role.toLowerCase()}/profile`),
      uploadToCloudinary(coverImageFile, `mind-soul/${role.toLowerCase()}/cover`),
    ]);

    const hashedPassword = await bcrypt.hash(password, 10);
    const languagesArray = parseLanguages(languages);
    const certificationsValue = parseCertifications(certifications);

    const payload = {
      professional_title,
      profession,
      about,
      experience_years,
    };

    const profile_completed = isProfileCompleted(payload, role);

    await db.query("BEGIN");

    const userResult = await db.query(
      `
      INSERT INTO users
      (
        first_name,
        last_name,
        email,
        phone,
        alternate_phone,
        password,
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
        profile_completed
      )
      VALUES
      (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29
      )
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
        created_at
      `,
      [
        first_name,
        last_name || null,
        email,
        phone || null,
        alternate_phone || null,
        hashedPassword,
        role,
        bio || null,
        experience_years ? Number(experience_years) : null,
        profile_image || null,
        cover_image || null,
        country || null,
        timezone || null,
        consultation_fee !== undefined && consultation_fee !== ""
          ? Number(consultation_fee)
          : null,
        professional_title || null,
        profession || null,
        whatsapp_number || null,
        city || null,
        state || null,
        education || null,
        certificationsValue,
        specialization || null,
        languagesArray,
        about || null,
        why_started || null,
        mission || null,
        client_approach || null,
        uniqueness || null,
        profile_completed,
      ]
    );

    const user = userResult.rows[0];

    await db.query(
      `
      INSERT INTO user_verifications (user_id, status)
      VALUES ($1, 'PENDING')
      `,
      [user.id]
    );

    await db.query("COMMIT");

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful.",
      token,
      data: user,
    });
  } catch (err) {
    await db.query("ROLLBACK");
    console.error("Register Error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  } finally {
    db.release();
  }
};
const checkAuth = async (req, res) => {
  try {
    const user = req.user;

    const result = await client.query(
      `
      SELECT *
      FROM users
      WHERE id = $1
      `,
      [user.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized.",
      });
    }

    const userData = result.rows[0];
    console.log("userData++++++++++++++++", userData);
    return res.status(200).json({
      success: true,
      message: "User authenticated successfully.",
      data: userData,
    });

  } catch (err) {
    console.error("Check Auth Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
};
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    const role = req.role;

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Phone and password are required.",
      });
    }

    const result = await client.query(
      `
      SELECT *
      FROM users
      WHERE phone = $1
      AND role = $2
      `,
      [phone, role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `${role.toLowerCase()} not found.`,
      });
    }

    const user = result.rows[0];

    const checkBlockedUser = await client.query(
      `
      SELECT *
      FROM user_blocks
      WHERE user_id = $1
      `,
      [user.id]
    );

    if (checkBlockedUser.rows.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked conact to support.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid password.",
      });
    }

    const token = generateToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    delete user.password;

    return res.status(200).json({
      success: true,
      message: `${role.toLowerCase()} login successful.`,
      data: user,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
};


const sendOtp = async (req, res) => {
  try {
    const phone =
      req.body?.phone ?? req.body?.mobile ?? req.body?.mobileNumber;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required.",
      });
    }

    const mobileNumber = normalizePhone(phone);
    if (mobileNumber.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be 10 digits.",
      });
    }

    const now = Date.now();
    const existingOtp = otpStore.get(mobileNumber);

    if (
      existingOtp?.lastSentAt &&
      now - existingOtp.lastSentAt < OTP_RESEND_COOLDOWN_MS
    ) {
      return res.status(429).json({
        success: false,
        message: "Please wait a minute before requesting another OTP.",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);

    const db = await client.connect();
    const userResult = await db.query(
      `
      SELECT first_name
      FROM users
      WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $1
      LIMIT 1
      `,
      [mobileNumber]
    );
    const first_name = userResult.rows[0]?.first_name || req.body?.first_name;

    const whatsappResponse = await sendOtpViaWhatsApp(
      mobileNumber,
      otp,
      first_name
    );

    otpStore.set(mobileNumber, {
      hashedOtp,
      expiry: now + OTP_EXPIRY_MS,
      lastSentAt: now,
    });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully via WhatsApp.",
      data: {
        phone: mobileNumber,
        queue_id: whatsappResponse?.message?.queue_id || null,
        message_status: whatsappResponse?.message?.message_status || "queued",
      },
    });
  } catch (error) {
    console.error("Send OTP Error:", {
      message: error.message,
      status: error.statusCode,
      details: error.details,
    });
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to send OTP. Please try again later.",
      error: error.details || null,
    });
  }
};
module.exports = {
  register,
  login,
  checkAuth,
  sendOtp,
};
