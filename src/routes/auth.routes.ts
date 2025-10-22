import { Router } from "express";
import { auth } from "../controllers/auth.controller.js";

const r = Router();

// Email-only login-or-register: final path is POST /auth
r.post("/", auth);

export default r;
