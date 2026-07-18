const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { client } = require("../cleint/client");
const { generateToken } = require("./common/generateToken");

const register = async (req, res) => {
    try {
        const { first_name, last_name, email, phone, password } = req.body;

        const role = req.role; 

        if (!first_name || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Required fields are missing."
            });
        }

        // Check email
        const emailCheck = await client.query(
            "SELECT id FROM users WHERE email = $1",
            [email]
        );

        if (emailCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Email already exists."
            });
        }

        // Check phone
        if (phone) {
            const phoneCheck = await client.query(
                "SELECT id FROM users WHERE phone = $1",
                [phone]
            );

            if (phoneCheck.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Phone already exists."
                });
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await client.query(
            `
            INSERT INTO users
            (
                first_name,
                last_name,
                email,
                phone,
                password,
                role
            )
            VALUES
            ($1,$2,$3,$4,$5,$6)
            RETURNING
            id,
            first_name,
            last_name,
            email,
            phone,
            role,
            profile_image,
            is_active,
            is_verified,
            created_at
            `,
            [
                first_name,
                last_name,
                email,
                phone,
                hashedPassword,
                role
            ]
        );

        return res.status(201).json({
            success: true,
            message: `${role.toLowerCase()} registered successfully.`,
            data: result.rows[0]
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
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
                message: "Phone and password are required."
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
                message: `${role.toLowerCase()} not found.`
            });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({
                success: false,
                message: "Account is inactive."
            });
        }

        const isMatch = await bcrypt.compare(
            password,
            user.password
        );

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password."
            });
        }

        const token = generateToken(user);

        delete user.password;

        return res.status(200).json({
            success: true,
            message: `${role.toLowerCase()} login successful.`,
            token,
            data: user
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error"
        });

    }
};



module.exports = {
    register,
    login
};