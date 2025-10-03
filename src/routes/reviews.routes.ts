import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createReviewForConsultation,
  getConsultationReviews,
  getPsychologistReviews, // ⬅️ baru
} from "../controllers/reviews.controller.js";

const r = Router();

/**
 * POST /consultations/:id/reviews
 * - Tambah ulasan setelah konsultasi selesai (patient/admin)
 * - body: { rating: 1..5, comment?: string }
 */
r.post(
  "/consultations/:id/reviews",
  requireAuth(["patient", "admin"]),
  createReviewForConsultation
);

/**
 * GET /consultations/:id/reviews
 * - Ambil ulasan untuk konsultasi tertentu (auth mengikuti logika existing)
 */
r.get(
  "/consultations/:id/reviews",
  requireAuth(),
  getConsultationReviews
);

/**
 * GET /psychologists/:id/reviews
 * - Ambil semua ulasan untuk psikolog (PUBLIC sesuai requirement)
 *   (kalau kamu ingin pakai auth, tinggal bungkus dengan requireAuth())
 */
r.get("/psychologists/:id/reviews", getPsychologistReviews);

export default r;
