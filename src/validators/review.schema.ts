import { z } from "zod";

export const createReviewSchema = z.object({
  consultation_id: z.coerce.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});
