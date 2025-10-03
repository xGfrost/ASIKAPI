import { Router } from "express";
import { login, register } from "../controllers/auth.controller.js";

const r = Router();
r.post("/register", register);

// NOTE: requirement bilang login/logout tidak wajib, tapi biar dev enak tetap sediakan login.
r.post("/login", login);

export default r;
