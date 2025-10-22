import { z } from "zod";
/** =========================
 *  Update profil user (self)
 * ==========================*/
export const updateUserSchema = z.object({
    full_name: z.string().min(2).max(150).optional(),
    /** URL gambar avatar/foto profil. Tidak dipaksa harus URL valid penuh,
     *  tapi kalau kamu mau strict, tinggal ganti ke .url() */
    image: z.string().max(2048).optional(),
    phone: z.string().max(30).optional(),
    gender: z.string().max(10).optional(),
    /** Terima "YYYY-MM-DD" ATAU ISO datetime (dengan offset/Z) */
    date_of_birth: z
        .union([
        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
            message: "Expected YYYY-MM-DD",
        }),
        z.string().datetime({ offset: true }),
    ])
        .optional(),
});
/** =========================
 *  Ganti password (self)
 * ==========================*/
export const changePasswordSchema = z.object({
    old_password: z.string().min(6),
    new_password: z.string().min(6),
});
/** =========================================================
 *  (Opsional) Admin: list user dengan filter + pagination
 *  - page & limit di-coerce agar aman dipakai sebagai number
 * ==========================================================*/
export const listUsersQuerySchema = z.object({
    q: z.string().optional(),
    role: z.enum(["patient", "psychologist", "admin"]).optional(),
    page: z.coerce.number().int().min(1).default(1).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(20).optional(),
    sort: z
        .enum(["created_desc", "created_asc", "name_asc", "name_desc"])
        .default("created_desc")
        .optional(),
});
