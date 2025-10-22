import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listMyConsultations, getConsultationById, createConsultation, updateConsultation, // status/jadwal
cancelConsultation // batalkan konsultasi
 } from "../controllers/consultations.controller.js";
const r = Router();
/**
 * GET /consultations
 *  - List konsultasi user login (pasien/psikolog). Admin: semua.
 */
r.get("/consultations", requireAuth(), listMyConsultations);
/**
 * GET /consultations/:id
 *  - Detail konsultasi (hanya pihak terkait atau admin)
 */
r.get("/consultations/:id", requireAuth(), getConsultationById);
/**
 * POST /consultations
 *  - Buat booking (role: patient/admin)
 *  - body: { psychologist_id, channel, scheduled_start_at, scheduled_end_at, patient_notes? }
 */
r.post("/consultations", requireAuth(["patient", "admin"]), createConsultation);
/**
 * PUT /consultations/:id
 *  - Update status/jadwal konsultasi (psychologist/admin).
 *  - body (opsional):
 *    { status?: "scheduled"|"ongoing"|"completed"|"cancelled"|"no_show"|"refunded",
 *      scheduled_start_at?: ISOString,
 *      scheduled_end_at?: ISOString }
 */
r.put("/consultations/:id", requireAuth(["psychologist", "admin"]), updateConsultation);
/**
 * DELETE /consultations/:id
 *  - Batalkan konsultasi (patient pemilik atau admin)
 */
r.delete("/consultations/:id", requireAuth(), cancelConsultation);
export default r;
