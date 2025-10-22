import { z } from "zod";
// Simple email-only auth (login-or-register)
export const authSchema = z.object({
    email: z.string().email(),
    full_name: z.string(),
    phone: z.string(),
});
