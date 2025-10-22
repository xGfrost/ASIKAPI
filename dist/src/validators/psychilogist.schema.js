import { z } from "zod";
export const upsertPsychologistSchema = z.object({
    license_no: z.string().optional(),
    bio: z.string().optional(),
    // harga boleh string numerik -> dicoerce jadi number
    price_chat: z.coerce.number().nonnegative().optional(),
    price_video: z.coerce.number().nonnegative().optional(),
    // ⬇️ inti perbaikan: terima ["1","2"] maupun [1,2]
    specialties: z.array(z.coerce.number().int()).optional()
});
export const availabilitySchema = z.object({
    // weekday juga dicoerce bila dikirim "1"
    weekday: z.coerce.number().int().min(0).max(6),
    // "2025-10-02T09:00:00.000Z" atau "09:00" (konversi di controller)
    start_time: z.string(),
    end_time: z.string()
});
