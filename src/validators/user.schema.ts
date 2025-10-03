import { z } from "zod";

// Update profil user (sendiri). Admin bisa pakai ini juga untuk update user lain
export const updateUserSchema = z.object({
  full_name: z.string().min(2).max(150).optional(),
  phone: z.string().max(30).optional(),
  gender: z.string().max(10).optional(),
  date_of_birth: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)) // terima "YYYY-MM-DD"
    .optional()
});

// Ganti password untuk user login
export const changePasswordSchema = z.object({
  old_password: z.string().min(6),
  new_password: z.string().min(6)
});

// (Opsional) Admin: list user dengan filter + pagination
export const listUsersQuerySchema = z.object({
  q: z.string().optional(),
  role: z.enum(["patient", "psychologist", "admin"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
  sort: z
    .enum(["created_desc", "created_asc", "name_asc", "name_desc"])
    .default("created_desc")
    .optional()
});
