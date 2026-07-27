
const createBlog = async (req, res) => {
    try {
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
            category_id,
            author_id,
            title,
            slug,
            short_description,
            content,
            featured_image,
            banner_image,
            status || "draft",
            is_featured || false,
            meta_title,
            meta_description,
            meta_keywords,
            published_at
        ];

        const result = await db.query(query, values);

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

        const result = await db.query(`
            SELECT
                b.*,
                c.name AS category,
                a.full_name AS author
            FROM blogs b
            LEFT JOIN blog_categories c
            ON b.category_id=c.id
            LEFT JOIN blog_authors a
            ON b.author_id=a.id
            ORDER BY b.created_at DESC
        `);

        res.json({
            success: true,
            count: result.rowCount,
            data: result.rows
        });

    } catch (err) {
        res.status(500).json({
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

        const result = await db.query(
            `
            SELECT
                b.*,
                c.name category,
                a.full_name author
            FROM blogs b
            LEFT JOIN blog_categories c
            ON b.category_id=c.id
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

        await db.query(
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

        const result = await db.query(
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
                published_at,
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

        await db.query(
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

const createCategory = async (req, res) => {
    try {
        const {
            name,
            slug,
            description,
            image_url,
            status
        } = req.body;

        const exists = await db.query(
            "SELECT id FROM blog_categories WHERE LOWER(name)=LOWER($1)",
            [name]
        );

        if (exists.rows.length) {
            return res.status(400).json({
                success: false,
                message: "Category already exists"
            });
        }

        const result = await db.query(
            `INSERT INTO blog_categories
            (name, slug, description, image_url, status)
            VALUES($1,$2,$3,$4,$5)
            RETURNING *`,
            [
                name,
                slug,
                description,
                image_url,
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
const getCategories = async (req, res) => {

    try {

        const result = await db.query(`
            SELECT
                bc.*,
                COUNT(b.id)::INT AS total_blogs
            FROM blog_categories bc
            LEFT JOIN blogs b
            ON bc.id=b.category_id
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
const getCategoryById = async (req, res) => {

    try {

        const { id } = req.params;

        const result = await db.query(
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
const updateCategory = async (req, res) => {

    try {

        const { id } = req.params;

        const {
            name,
            slug,
            description,
            image_url,
            status
        } = req.body;

        const result = await db.query(
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
                image_url,
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
const deleteCategory = async (req, res) => {

    try {

        const { id } = req.params;

        const blogCheck = await db.query(
            "SELECT COUNT(*) FROM blogs WHERE category_id=$1",
            [id]
        );

        if (Number(blogCheck.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                message: "Category cannot be deleted because it contains blogs."
            });
        }

        const result = await db.query(
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
const getBlogsByCategory = async (req, res) => {

    try {

        const { slug } = req.params;

        const result = await db.query(
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
                ON b.category_id=c.id
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
    createCategory,
    getCategories,
    getCategoryById,
    updateCategory,
    deleteCategory,
    getBlogsByCategory
};