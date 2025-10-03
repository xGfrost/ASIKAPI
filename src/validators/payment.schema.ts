import { z } from "zod";

export const createPaymentSchema = z.object({
  consultation_id: z.coerce.bigint(),
  method: z.string().min(2),
  amount: z.coerce.number().positive()
});

export const paymentWebhookSchema = z.object({
  external_id: z.string(),
  status: z.enum(["pending", "paid", "failed"]),
  paid_at: z.string().optional()
});
