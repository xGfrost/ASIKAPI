import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getPsychologistDashboard,
  listPsychologistConsultationsByStatus,
  getPsychologistPaymentsSummary,
  listPsychologistIntakeFormsDash,
  getPsychologistAiReports
} from "../controllers/dashboard.controller.js";

const r = Router();

/**
 * GET /psychologists/:id/dashboard
 */
r.get("/psychologists/:id/dashboard", requireAuth(["psychologist","admin"]), getPsychologistDashboard);

/**
 * GET /psychologists/:id/consultations?status=scheduled
 */
r.get("/psychologists/:id/consultations", requireAuth(["psychologist","admin"]), listPsychologistConsultationsByStatus);

/**
 * GET /psychologists/:id/payments
 */
r.get("/psychologists/:id/payments", requireAuth(["psychologist","admin"]), getPsychologistPaymentsSummary);

/**
 * GET /psychologists/:id/intake-forms
 *  - versi untuk dashboard (ringkas)
 */
r.get("/psychologists/:id/intake-forms", requireAuth(["psychologist","admin"]), listPsychologistIntakeFormsDash);

/**
 * GET /psychologists/:id/ai-reports
 */
r.get("/psychologists/:id/ai-reports", requireAuth(["psychologist","admin"]), getPsychologistAiReports);

export default r;
