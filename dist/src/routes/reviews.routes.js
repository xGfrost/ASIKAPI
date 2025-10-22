import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createReviewForConsultation, getConsultationReviews, getPsychologistReviews, } from "../controllers/reviews.controller.js";
const r = Router();
/**
 * POST /consultations/:id/reviews
 *  - patient pemilik konsultasi / admin
 */
r.post("/consultations/:id/reviews", requireAuth(["patient", "admin"]), createReviewForConsultation);
/**
 * GET /consultations/:id/reviews
 */
r.get("/consultations/:id/reviews", requireAuth(), // siapa pun yang login boleh lihat
getConsultationReviews);
/**
 * GET /psychologists/:id/reviews
 */
r.get("/psychologists/:id/reviews", requireAuth(), // siapa pun yang login boleh lihat
getPsychologistReviews);
export default r;
