import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createIntakeForm, getConsultationIntakeForm, updateIntakeForm, listPsychologistIntakeForms } from "../controllers/intake_forms.controller.js";
const r = Router();
/**
 * POST /consultations/:id/intake-form
 *  - Isi form keluhan sebelum konsultasi (patient pemilik atau admin)
 */
r.post("/consultations/:id/intake-form", requireAuth(), createIntakeForm);
/**
 * GET /consultations/:id/intake-form
 *  - Ambil form keluhan untuk konsultasi tsb (pihak terkait/admin)
 */
r.get("/consultations/:id/intake-form", requireAuth(), getConsultationIntakeForm);
/**
 * PUT /consultations/:id/intake-form
 *  - Update form keluhan (patient pemilik atau admin)
 */
r.put("/consultations/:id/intake-form", requireAuth(), updateIntakeForm);
/**
 * GET /psychologists/:id/intake-forms
 *  - List semua intake forms pasien untuk psikolog tsb (owner/admin)
 */
r.get("/psychologists/:id/intake-forms", requireAuth(["psychologist", "admin"]), listPsychologistIntakeForms);
export default r;
