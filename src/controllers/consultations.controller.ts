import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { createConsultationSchema } from "../validators/consultation.schema.js";

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

function canSeeConsultation(actor: any, c: { patient_id: bigint; psychologist_id: bigint }) {
  return actor.role === "admin" || actor.id === c.patient_id || actor.id === c.psychologist_id;
}

export async function createConsultation(req: Request, res: Response) {
  const patientId: bigint = (req as any).user.id;
  const body = createConsultationSchema.parse(req.body);

  const psy = await prisma.psychologists.findUnique({ where: { id: body.psychologist_id } });
  if (!psy) return res.status(404).json({ error: { message: "Psychologist not found" } });

  const start = new Date(body.scheduled_start_at);
  const end = new Date(body.scheduled_end_at);
  if (end <= start) return res.status(400).json({ error: { message: "Invalid schedule range" } });

  // cek bentrok konsultasi psikolog
  const existing = await prisma.consultations.findMany({
    where: {
      psychologist_id: body.psychologist_id,
      status: { in: ["scheduled", "ongoing"] }
    },
    select: { scheduled_start_at: true, scheduled_end_at: true }
  });
  const isClash = existing.some(c => overlaps(start, end, c.scheduled_start_at, c.scheduled_end_at));
  if (isClash) return res.status(409).json({ error: { message: "Schedule conflict" } });

  const price = body.channel === "chat" ? psy.price_chat : psy.price_video;

  const c = await prisma.consultations.create({
    data: {
      patient_id: patientId,
      psychologist_id: body.psychologist_id,
      channel: body.channel,
      status: "scheduled",
      scheduled_start_at: start,
      scheduled_end_at: end,
      price: price ?? null,
      patient_notes: body.patient_notes
    }
  });

  res.status(201).json({ consultation: c });
}

export async function listMyConsultations(req: Request, res: Response) {
  const u = (req as any).user;
  const where =
    u.role === "psychologist" ? { psychologist_id: u.id } :
    u.role === "patient" ? { patient_id: u.id } :
    {};

  const items = await prisma.consultations.findMany({
    where,
    orderBy: { scheduled_start_at: "desc" },
    include: {
      patient: true,
      psychologist: { include: { user: true } },
      payments: true,
      review: true,
      stream_channel: true
    }
  });
  res.json({ items });
}

export async function getConsultationById(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const c = await prisma.consultations.findUnique({
    where: { id },
    include: {
      patient: true,
      psychologist: { include: { user: true } },
      payments: true,
      review: true,
      stream_channel: true
    }
  });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

  const actor = (req as any).user;
  if (!canSeeConsultation(actor, c)) return res.status(403).json({ error: { message: "Forbidden" } });

  res.json({ consultation: c });
}

// PUT /consultations/:id  (status/jadwal)
export async function updateConsultation(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  const current = await prisma.consultations.findUnique({ where: { id } });
  if (!current) return res.status(404).json({ error: { message: "Consultation not found" } });

  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === current.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { status, scheduled_start_at, scheduled_end_at } = req.body as
    { status?: "scheduled"|"ongoing"|"completed"|"cancelled"|"no_show"|"refunded";
      scheduled_start_at?: string; scheduled_end_at?: string };

  const data: any = { updated_at: new Date() };

  if (status) data.status = status;

  if (scheduled_start_at || scheduled_end_at) {
    const start = new Date(scheduled_start_at ?? current.scheduled_start_at);
    const end = new Date(scheduled_end_at ?? current.scheduled_end_at);
    if (end <= start) return res.status(400).json({ error: { message: "Invalid schedule range" } });

    // cek bentrok (exclude current id)
    const existing = await prisma.consultations.findMany({
      where: {
        id: { not: id },
        psychologist_id: current.psychologist_id,
        status: { in: ["scheduled", "ongoing"] }
      },
      select: { scheduled_start_at: true, scheduled_end_at: true }
    });
    const isClash = existing.some(c => overlaps(start, end, c.scheduled_start_at, c.scheduled_end_at));
    if (isClash) return res.status(409).json({ error: { message: "Schedule conflict" } });

    data.scheduled_start_at = start;
    data.scheduled_end_at = end;
  }

  const updated = await prisma.consultations.update({ where: { id }, data });
  res.json({ consultation: updated });
}

// DELETE /consultations/:id
export async function cancelConsultation(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({ where: { id } });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

  if (!(actor.role === "admin" || actor.id === c.patient_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const updated = await prisma.consultations.update({
    where: { id },
    data: { status: "cancelled", updated_at: new Date() }
  });
  res.json({ consultation: updated });
}
