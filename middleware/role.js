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

module.exports = {
    userRole,
    expertRole,
    adminRole
};