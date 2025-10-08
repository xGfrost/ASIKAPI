import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createPayment,
  listPayments,
  getPaymentById,
  updatePaymentStatus,
  paymentWebhook,
} from "../controllers/payments.controller.js";

const r = Router();

/**
 * Webhook dari payment gateway (biasanya TANPA auth).
 * Penting: taruh SEBELUM `/:id` agar tidak ketabrak param id.
 */
r.post("/webhook", paymentWebhook);

/** CRUD pembayaran */
r.post("/", requireAuth(), createPayment);               // POST /payments
r.get("/", requireAuth(), listPayments);                  // GET  /payments
r.get("/:id", requireAuth(), getPaymentById);             // GET  /payments/:id
r.put("/:id", requireAuth(["admin"]), updatePaymentStatus); // PUT  /payments/:id

export default r;
