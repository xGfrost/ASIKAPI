// Util sederhana untuk pagination konsisten di seluruh controller.
// - Ambil page/limit dari query (fallback default)
// - Hitung skip/take (Prisma)
// - Sediakan helper untuk meta response
export function parsePagination(q, defaults = { page: 1, limit: 20 }) {
    const page = Math.max(1, Number(q.page ?? defaults.page) || defaults.page);
    const limit = Math.min(100, Math.max(1, Number(q.limit ?? defaults.limit) || defaults.limit)); // cap 100
    const skip = (page - 1) * limit;
    const take = limit;
    return { page, limit, skip, take };
}
export function buildPageInfo(total, page, limit) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
    };
}
// Helper umum untuk format respons
export function withPagination(items, total, page, limit) {
    return {
        items,
        meta: buildPageInfo(total, page, limit)
    };
}
