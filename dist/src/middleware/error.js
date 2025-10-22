export function errorHandler(err, _req, res, _next) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({
        error: {
            message: err.message || "Internal Server Error",
            code: err.code || "INTERNAL_ERROR"
        }
    });
}
