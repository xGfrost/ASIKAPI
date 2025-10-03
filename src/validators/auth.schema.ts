import { z } from "zod";

export const registerSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["patient", "psychologist", "admin"]).default("patient"),
  phone: z.string().optional(),
  gender: z.string().optional(),
  date_of_birth: z.string().optional() // ISO date
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});
