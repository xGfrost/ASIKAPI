import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { me, updateMe, adminListUsers, adminGetUser, adminDeleteUser } from "../controllers/users.controller.js";
const r = Router();
// Me
r.get("/me", requireAuth(), me);
r.put("/me", requireAuth(), updateMe);
// Admin
r.get("/", requireAuth(["admin"]), adminListUsers);
r.get("/:id", requireAuth(["admin"]), adminGetUser);
r.delete("/:id", requireAuth(["admin"]), adminDeleteUser);
export default r;
