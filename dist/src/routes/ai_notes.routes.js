import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { saveAiConsultationNotes, getAiConsultationNotes, updateAiConsultationNotes } from "../controllers/ai_notes.controller.js";
const r = Router();
/**
 * POST /consultations/:id/ai-notes
 *  - Simpan catatan AI (selesai/during session) (psychologist/admin)
 */
r.post("/consultations/:id/ai-notes", requireAuth(["psychologist", "admin"]), saveAiConsultationNotes);
/**
 * GET /consultations/:id/ai-notes
 *  - Ambil catatan AI konsultasi (pihak terkait/admin)
 */
r.get("/consultations/:id/ai-notes", requireAuth(), getAiConsultationNotes);
/**
 * PUT /consultations/:id/ai-notes
 *  - Update catatan AI konsultasi (psychologist/admin)
 */
r.put("/consultations/:id/ai-notes", requireAuth(["psychologist", "admin"]), updateAiConsultationNotes);
export default r;
