import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /psychologists/:id/availabilities
export async function createAvailabilityForPsy(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const psyId = BigInt(req.params.id);
  const actor = (req as any).user;

  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === psyId)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { weekday, start_time, end_time } = req.body as { weekday: number; start_time: string; end_time: string };
  if (weekday == null || !start_time || !end_time) {
    return res.status(400).json({ error: { message: "weekday, start_time, end_time are required" } });
  }

  const start = new Date(start_time);
  const end = new Date(end_time);
  if (end <= start) return res.status(400).json({ error: { message: "end_time must be after start_time" } });

  const av = await prisma.availabilities.create({
    data: { psychologist_id: psyId, weekday, start_time: start, end_time: end }
  });

  res.status(201).json({ availability: av });
}

// PUT /availabilities/:id
export async function updateAvailability(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const av = await prisma.availabilities.findUnique({ where: { id } });
  if (!av) return res.status(404).json({ error: { message: "Availability not found" } });

  const actor = (req as any).user;
  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === av.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { weekday, start_time, end_time } = req.body as { weekday?: number; start_time?: string; end_time?: string };
  let data: any = {};
  if (weekday != null) data.weekday = weekday;
  if (start_time) data.start_time = new Date(start_time);
  if (end_time) data.end_time = new Date(end_time);

  const updated = await prisma.availabilities.update({ where: { id }, data });
  res.json({ availability: updated });
}

// DELETE /availabilities/:id
export async function deleteAvailability(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const av = await prisma.availabilities.findUnique({ where: { id } });
  if (!av) return res.status(404).json({ error: { message: "Availability not found" } });

  const actor = (req as any).user;
  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === av.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  await prisma.availabilities.delete({ where: { id } });
  res.json({ ok: true });
}

// GET /psychologists/:id/availabilities (PUBLIC)
export async function listPsychologistAvailabilities(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

    const id = BigInt(req.params.id);
  
    const items = await prisma.availabilities.findMany({
      where: { psychologist_id: id },
      orderBy: [{ weekday: "asc" }, { start_time: "asc" }]
    });
  
    res.json({ items });
  }
  
