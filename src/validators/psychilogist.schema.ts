import { z } from "zod";

export const upsertPsychologistSchema = z.object({
  license_no: z.string().optional(),
  bio: z.string().optional(),
  price_chat: z.coerce.number().nonnegative().optional(),
  price_video: z.coerce.number().nonnegative().optional(),
  specialties: z.array(z.number().int()).optional()
});

export const availabilitySchema = z.object({
  weekday: z.number().int().min(0).max(6),
  start_time: z.string(), // "2025-10-02T09:00:00.000Z" or "09:00" (convert later)
  end_time: z.string()
});
