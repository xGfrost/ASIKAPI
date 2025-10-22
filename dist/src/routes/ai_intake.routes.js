import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { runAiIntakeAnalysis, getAiIntakeAnalysis } from "../controllers/ai_intake.controller.js";
const r = Router();
/**
 * POST /consultations/:id/intake-form/ai-analysis
 *  - Jalankan analisis AI untuk intake form konsultasi tsb (psychologist/admin)
 */
r.post("/consultations/:id/intake-form/ai-analysis", requireAuth(["psychologist", "admin"]), runAiIntakeAnalysis);
/**
 * GET /consultations/:id/intake-form/ai-analysis
 *  - Ambil hasil analisis AI intake form (pihak terkait/admin)
 */
r.get("/consultations/:id/intake-form/ai-analysis", requireAuth(), getAiIntakeAnalysis);
export default r;
