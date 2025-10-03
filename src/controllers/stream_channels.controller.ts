import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /consultations/:id/stream-channel
export async function attachStreamChannel(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === c.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { stream_channel_id, stream_type } = req.body as { stream_channel_id: string; stream_type?: string };
  if (!stream_channel_id) return res.status(400).json({ error: { message: "stream_channel_id is required" } });

  const sc = await prisma.stream_channels.upsert({
    where: { consultation_id: id },
    update: { stream_channel_id, stream_type },
    create: { consultation_id: id, stream_channel_id, stream_type }
  });

  res.status(201).json({ stream_channel: sc });
}

// GET /consultations/:id/stream-channel
export async function getStreamChannel(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({ where: { id }, select: { patient_id: true, psychologist_id: true } });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

  if (!(actor.role === "admin" || actor.id === c.patient_id || actor.id === c.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const sc = await prisma.stream_channels.findUnique({ where: { consultation_id: id } });
  if (!sc) return res.status(404).json({ error: { message: "Stream channel not found" } });
  res.json({ stream_channel: sc });
}
