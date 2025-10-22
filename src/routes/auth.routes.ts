import { Router } from "express";
import { auth } from "../controllers/auth.controller.js";

const r = Router();

// NOTE: requirement bilang login/logout tidak wajib, tapi biar dev enak tetap sediakan login.
r.post("/auth", auth);

export default r;
