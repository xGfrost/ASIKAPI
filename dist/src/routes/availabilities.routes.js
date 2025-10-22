// src/routes/availabilities.routes.ts
import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { createAvailabilityForPsy, updateAvailability, deleteAvailability } from "../controllers/availabilities.controller.js";
// GET list jadwal sudah ada logic-nya di psychologists.controller
import { listPsychologistAvailabilities } from "../controllers/psychologists.controller.js";
const r = Router();
/**
 * GET /psychologists/:id/availabilities
 * - Lihat jadwal ketersediaan psikolog (PUBLIC)
 * - Sesuai requirement: tidak butuh login
 */
r.get("/psychologists/:id/availabilities", listPsychologistAvailabilities);
/**
 * POST /psychologists/:id/availabilities
 * - Tambah jadwal (owner psikolog atau admin)
 */
r.post("/psychologists/:id/availabilities", requireAuth(["admin", "psychologist"]), createAvailabilityForPsy);
/**
 * PUT /availabilities/:id
 * - Update jadwal (owner psikolog atau admin)
 */
r.put("/availabilities/:id", requireAuth(["admin", "psychologist"]), updateAvailability);
/**
 * DELETE /availabilities/:id
 * - Hapus jadwal (owner psikolog atau admin)
 */
r.delete("/availabilities/:id", requireAuth(["admin", "psychologist"]), deleteAvailability);
export default r;
