// Util sederhana untuk pagination konsisten di seluruh controller.
// - Ambil page/limit dari query (fallback default)
// - Hitung skip/take (Prisma)
// - Sediakan helper untuk meta response dan versi flat.

export type PageQuery = {
  page?: string | number;
  limit?: string | number;
};

export type PageInfo = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

export function parsePagination(
  q: PageQuery,
  defaults = { page: 1, limit: 20 }
) {
  const page = Math.max(1, Number(q.page ?? defaults.page) || defaults.page);
  // batasi limit maksimal 100 agar aman
  const limit = Math.min(
    100,
    Math.max(1, Number(q.limit ?? defaults.limit) || defaults.limit)
  );
  const skip = (page - 1) * limit;
  const take = limit;
  return { page, limit, skip, take };
}

export function buildPageInfo(total: number, page: number, limit: number): PageInfo {
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

/**
 * ✅ Versi FLAT (baru) — cocok untuk controller yang mengharapkan
 * { items, page, limit, total, has_next, has_prev }
 */
export function withPagination<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  const meta = buildPageInfo(total, page, limit);
  return {
    items,
    page: meta.page,
    limit: meta.limit,
    total: meta.total,
    has_next: meta.hasNext,
    has_prev: meta.hasPrev,
  };
}

/**
 * ✅ Versi META (lama) — tetap disediakan agar tidak breaking
 * { items, meta: PageInfo }
 */
export function withPaginationMeta<T>(
  items: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    items,
    meta: buildPageInfo(total, page, limit),
  };
}
