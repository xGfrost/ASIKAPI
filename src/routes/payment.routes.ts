import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createPayment,
  listPayments,
  getPaymentById,
  updatePaymentStatus,
  paymentWebhook
} from "../controllers/payments.controller.js";

const r = Router();

/**
 * POST /payments
 *  - Buat pembayaran untuk konsultasi (user login)
 *  - body: { consultation_id, method, amount }
 */
r.post("/payments", requireAuth(), createPayment);

/**
 * GET /payments
 *  - List pembayaran user login; Admin: semua
 *  - query opsional: status, consultation_id
 */
r.get("/payments", requireAuth(), listPayments);

/**
 * GET /payments/:id
 *  - Detail pembayaran (pemilik atau admin)
 */
r.get("/payments/:id", requireAuth(), getPaymentById);

/**
 * PUT /payments/:id
 *  - Update status pembayaran (admin atau gateway callback “internal”)
 *  - body: { status: "pending"|"paid"|"failed", paid_at?: ISOString }
 */
r.put("/payments/:id", requireAuth(["admin"]), updatePaymentStatus);

/**
 * POST /payments/webhook
 *  - Endpoint webhook (tanpa auth) dari payment gateway
 */
r.post("/payments/webhook", paymentWebhook);

export default r;
