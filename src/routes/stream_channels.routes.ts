import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  attachStreamChannel,
  getStreamChannel
} from "../controllers/stream_channels.controller.js";

const r = Router();

/**
 * POST /consultations/:id/stream-channel
 *  - Buat/attach channel GetStream untuk chat/video
 *  - role: psychologist/admin (opsional: patient bila perlu)
 *  - body: { stream_channel_id: string, stream_type?: string }
 */
r.post("/consultations/:id/stream-channel", requireAuth(["psychologist","admin"]), attachStreamChannel);

/**
 * GET /consultations/:id/stream-channel
 *  - Ambil info channel GetStream
 *  - role: pihak terkait (patient/psychologist) atau admin
 */
r.get("/consultations/:id/stream-channel", requireAuth(), getStreamChannel);

export default r;
