import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  listSpecialties,
  adminCreateSpecialty,
  assignPsychologistSpecialties,
  removePsychologistSpecialty,
} from "../controllers/specialties.controller.js";

const r = Router();

// specialties master
r.get("/specialties", listSpecialties);
r.post("/specialties", requireAuth(["admin"]), adminCreateSpecialty);

// assign specialties ke psikolog
r.post("/psychologists/:id/specialties", requireAuth(["admin", "psychologist"]), assignPsychologistSpecialties);
r.delete("/psychologists/:id/specialties/:sid", requireAuth(["admin", "psychologist"]), removePsychologistSpecialty);

export default r;
