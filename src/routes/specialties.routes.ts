import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listSpecialties,
  adminCreateSpecialty,
  assignPsychologistSpecialties,
  removePsychologistSpecialty
} from "../controllers/specialties.controller.js";

const r = Router();

r.get("/", listSpecialties);
r.post("/", requireAuth(["admin"]), adminCreateSpecialty);

// Assign / Remove
r.post("/psychologists/:id/specialties", requireAuth(["admin"]), assignPsychologistSpecialties);
r.delete("/psychologists/:id/specialties/:sid", requireAuth(["admin"]), removePsychologistSpecialty);

export default r;
