const { client } = require("../cleint/client");
const { uploadToCloudinary } = require("../cleint/cloudinary");

const parseBoolean = (value, defaultValue = false) => {
    if (value === true || value === "true" || value === "1") {
        return true;
    }

    if (value === false || value === "false" || value === "0") {
        return false;
    }

    return defaultValue;
};

const parseOptionalInt = (value) => {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const createBlog = async (req, res) => {
    try {
        const {
            category_id,
            author_id,
            title,
            slug,
            short_description,
            content,
            status,
            is_featured,
            meta_title,
            meta_description,
            meta_keywords,
            published_at
        } = req.body;

        const featuredImageFile = req.files?.featured_image?.[0] || null;
        const bannerImageFile = req.files?.banner_image?.[0] || null;

        const [featured_image, banner_image] = await Promise.all([
            uploadToCloudinary(featuredImageFile, "mind-soul/blogs/featured"),
            uploadToCloudinary(bannerImageFile, "mind-soul/blogs/banner"),
        ]);

        const query = `
            INSERT INTO blogs(
                category_id,
                author_id,
                title,
                slug,
                short_description,
                content,
                featured_image,
                banner_image,
                status,
                is_featured,
                meta_title,
                meta_description,
                meta_keywords,
                published_at
            )
            VALUES(
                $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14
            )
            RETURNING *;
        `;

        const values = [
            category_id || null,
            parseOptionalInt(author_id),
            title,
            slug,
            short_description,
            content,
            featured_image,
            banner_image,
            status || "draft",
            parseBoolean(is_featured, false),
            meta_title || null,
            meta_description || null,
            meta_keywords || null,
            published_at || null
        ];

        const result = await client.query(query, values);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: err.message
        });
    }
};


/**
 * Get All Blogs
 */
const getBlogs = async (req, res) => {
    try {
        const { category_id, slug } = req.query;

        console.log("========== GET BLOGS ==========");
        console.log("category_id:", category_id);
        console.log("slug:", slug);

        let query = `
            SELECT
                b.*,

                CASE
                    WHEN c.uuid IS NOT NULL THEN
                        json_build_object(
                            'uuid', c.uuid,
                            'name', c.name,
                            'slug', c.slug,
                            'description', c.description,
                            'image_url', c.image_url,
                            'status', c.status
                        )
                    ELSE NULL
                END AS category,

                CASE
                    WHEN a.id IS NOT NULL THEN
                        json_build_object(
                            'id', a.id,
                            'full_name', a.full_name
                        )
                    ELSE NULL
                END AS author

            FROM blogs b

            LEFT JOIN blog_categories c
                ON b.category_id = c.uuid

            LEFT JOIN blog_authors a
                ON b.author_id = a.id
        `;

        const conditions = [];
        const values = [];

        // Filter by category UUID
        if (category_id) {
            values.push(category_id);

            conditions.push(
                `b.category_id = $${values.length}`
            );
        }

        // Filter by blog slug
        if (slug) {
            values.push(slug);

            conditions.push(
                `b.slug = $${values.length}`
            );
        }

        // Add WHERE only when filters exist
        if (conditions.length > 0) {
            query += `
                WHERE ${conditions.join(" AND ")}
            `;
        }

        query += `
            ORDER BY b.created_at DESC
        `;

        console.log("SQL:", query);
        console.log("Values:", values);

        const result = await client.query(query, values);

        // Blog slug is unique, so return one object
        if (slug) {
            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Blog not found"
                });
            }

            return res.status(200).json({
                success: true,
                data: result.rows[0]
            });
        }

        // Otherwise return list
        return res.status(200).json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (err) {
        console.error("========== GET BLOGS ERROR ==========");
        console.error("Message:", err.message);
        console.error("Code:", err.code);
        console.error("Detail:", err.detail);
        console.error("Stack:", err.stack);

        return res.status(500).json({
            success: false,
            message: err.message
        });
    }
};
/**
 * Get Blog By Slug
 */
const getBlogBySlug = async (req, res) => {

    try {

        const { slug } = req.params;

        const result = await client.query(
            `
            SELECT
                b.*,
                c.name category,
                a.full_name author
            FROM blogs b
            LEFT JOIN blog_categories c
            ON b.category_id = c.uuid
            LEFT JOIN blog_authors a
            ON b.author_id=a.id
            WHERE b.slug=$1
            `,
            [slug]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Blog not found"
            });
        }

        await client.query(
            "UPDATE blogs SET views=views+1 WHERE slug=$1",
            [slug]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/**
 * Update Blog
 */
const updateBlog = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            category_id,
            author_id,
            title,
            slug,
            short_description,
            content,
            featured_image,
            banner_image,
            status,
            is_featured,
            meta_title,
            meta_description,
            meta_keywords,
            published_at
        } = req.body;

        const featuredImageFile = req.files?.featured_image?.[0] || null;
        const bannerImageFile = req.files?.banner_image?.[0] || null;

        let featuredImageUrl = featured_image || null;
        let bannerImageUrl = banner_image || null;

        if (featuredImageFile) {
            featuredImageUrl = await uploadToCloudinary(
                featuredImageFile,
                "mind-soul/blogs/featured"
            );
        }

        if (bannerImageFile) {
            bannerImageUrl = await uploadToCloudinary(
                bannerImageFile,
                "mind-soul/blogs/banner"
            );
        }

        const result = await client.query(
            `
            UPDATE blogs
            SET
                category_id=$1,
                author_id=$2,
                title=$3,
                slug=$4,
                short_description=$5,
                content=$6,
                featured_image=$7,
                banner_image=$8,
                status=$9,
                is_featured=$10,
                meta_title=$11,
                meta_description=$12,
                meta_keywords=$13,
                published_at=$14,
                updated_at=NOW()
            WHERE id=$15
            RETURNING *;
            `,
            [
                category_id || null,
                parseOptionalInt(author_id),
                title,
                slug,
                short_description,
                content,
                featuredImageUrl,
                bannerImageUrl,
                status,
                parseBoolean(is_featured, false),
                meta_title || null,
                meta_description || null,
                meta_keywords || null,
                published_at || null,
                id
            ]
        );

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};


/**
 * Delete Blog
 */
const deleteBlog = async (req, res) => {

    try {

        const { id } = req.params;

        await client.query(
            "DELETE FROM blogs WHERE id=$1",
            [id]
        );

        res.json({
            success: true,
            message: "Blog deleted successfully"
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

};

const createCategoryForBlog = async (req, res) => {
    try {
        const {
            name,
            slug,
            description,
            image_url,
            status
        } = req.body;

        const exists = await client.query(
            "SELECT id FROM blog_categories WHERE LOWER(name)=LOWER($1)",
            [name]
        );

        if (exists.rows.length) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        let imageUrl = image_url || null;
        if (req.file) {
            imageUrl = await uploadToCloudinary(
                req.file,
                "mind-soul/blogs/categories"
            );
        }

        const result = await client.query(
            `INSERT INTO blog_categories
            (name, slug, description, image_url, status)
            VALUES($1,$2,$3,$4,$5)
            RETURNING *`,
            [
                name,
                slug,
                description,
                imageUrl,
                status ?? true
            ]
        );

        res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: result.rows[0]
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


/**
 * Get All Categories
 */
const getCategoriesForBlog = async (req, res) => {

    try {

        const result = await client.query(`
            SELECT
                bc.*,
                COUNT(b.id)::INT AS total_blogs
            FROM blog_categories bc
            LEFT JOIN blogs b
            ON bc.uuid = b.category_id
            GROUP BY bc.id
            ORDER BY bc.name ASC
        `);

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


/**
 * Get Category By ID
 */
const getCategoryByIdForBlog = async (req, res) => {

    try {

        const { id } = req.params;

        const result = await client.query(
            "SELECT * FROM blog_categories WHERE id=$1",
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


/**
 * Update Category
 */
const updateCategoryForBlog = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            slug,
            description,
            image_url,
            status
        } = req.body;

        let imageUrl = image_url || null;
        if (req.file) {
            imageUrl = await uploadToCloudinary(
                req.file,
                "mind-soul/blogs/categories"
            );
        }

        const result = await client.query(
            `
            UPDATE blog_categories
            SET
                name=$1,
                slug=$2,
                description=$3,
                image_url=$4,
                status=$5,
                updated_at=NOW()
            WHERE id=$6
            RETURNING *
            `,
            [
                name,
                slug,
                description,
                imageUrl,
                status,
                id
            ]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category updated successfully",
            data: result.rows[0]
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


/**
 * Delete Category
 */
const deleteCategoryForBlog = async (req, res) => {

    try {

        const { id } = req.params;

        const blogCheck = await client.query(
            `SELECT COUNT(*) FROM blogs b
             INNER JOIN blog_categories bc ON b.category_id = bc.uuid
             WHERE bc.id = $1`,
            [id]
        );

        if (Number(blogCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: "Category cannot be deleted because it contains blogs."
            });
        }

        const result = await client.query(
            "DELETE FROM blog_categories WHERE id=$1 RETURNING *",
            [id]
        );

        if (!result.rows.length) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        res.json({
            success: true,
            message: "Category deleted successfully"
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};


/**
 * Get Blogs By Category Slug
 */
const getBlogsByCategoryForBlog = async (req, res) => {

    try {

        const { slug } = req.params;

        const result = await client.query(
            `
            SELECT
                b.id,
                b.title,
                b.slug,
                b.short_description,
                b.featured_image,
                b.created_at,
                a.full_name AS author
            FROM blogs b
            INNER JOIN blog_categories c
                ON b.category_id = c.uuid
            LEFT JOIN blog_authors a
                ON b.author_id=a.id
            WHERE c.slug=$1
              AND b.status='published'
            ORDER BY b.created_at DESC
            `,
            [slug]
        );

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (error) {

        res.status(500).json({
            success: false,
            message: error.message
        });

    }

};
module.exports = {
    createBlog,
    getBlogs,
    getBlogBySlug,
    updateBlog,
    deleteBlog,
    createCategoryForBlog,
    getCategoriesForBlog,
    getCategoryByIdForBlog,
    updateCategoryForBlog,
    deleteCategoryForBlog,
    getBlogsByCategoryForBlog
};