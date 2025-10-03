import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getNotifications, exportReport } from "../controllers/utilities.controller.js";

const r = Router();

/**
 * GET /notifications
 *  - Ambil notifikasi user login (mock/derived dari data)
 */
r.get("/notifications", requireAuth(), getNotifications);

/**
 * POST /export/report
 *  - Export laporan administrasi (admin)
 *  - body (opsional): { from?: ISO, to?: ISO }
 */
r.post("/export/report", requireAuth(["admin"]), exportReport);

export default r;
