import { z } from "zod";

export const createConsultationSchema = z.object({
  psychologist_id: z.coerce.bigint(),
  channel: z.enum(["chat", "video"]),
  scheduled_start_at: z.string(), // ISO
  scheduled_end_at: z.string(),
  patient_notes: z.string().optional()
});
