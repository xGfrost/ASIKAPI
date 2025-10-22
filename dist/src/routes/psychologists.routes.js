import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { listPsychologists, getPsychologistById, adminCreatePsychologist, updatePsychologistById, listPsychologistReviews, listPsychologistAvailabilities } from "../controllers/psychologists.controller.js";
const r = Router();
// Public
r.get("/", listPsychologists);
r.get("/:id", getPsychologistById);
r.get("/:id/reviews", listPsychologistReviews);
r.get("/:id/availabilities", listPsychologistAvailabilities);
// Admin create
r.post("/", requireAuth(["admin"]), adminCreatePsychologist);
// Admin atau Owner (psikolog yang sama dengan :id)
r.put("/:id", requireAuth(["admin", "psychologist"]), updatePsychologistById);
export default r;
