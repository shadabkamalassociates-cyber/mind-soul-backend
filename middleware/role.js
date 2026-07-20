const userRole = (req, res, next) => {
    req.role = "USER";
    next();
};

const expertRole = (req, res, next) => {
    req.role = "EXPERT";
    next();
};

const adminRole = (req, res, next) => {
    req.role = "ADMIN";
    next();
};


const protect = (req, res, next) => {
    const token = req.cookies.token;
    const decoded = jwt.decode(token);
    console.log(decoded);
    if (!decoded) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
};

module.exports = {
    userRole,
    expertRole,
    adminRole,
    protect
};