import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { createConsultationSchema } from "../validators/consultation.schema.js";
import { z } from "zod";

// ---------------- Utils ----------------
function toBigInt(v: any): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(v);
  if (typeof v === "string" && v.length > 0) return BigInt(v);
  // fallback aman (akan meledak kalau tak valid)
  return BigInt(v);
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

const StatusEnum = z.enum([
  "scheduled",
  "ongoing",
  "completed",
  "cancelled",
  "no_show",
  "refunded",
]);

function canSeeConsultation(
  actor: any,
  c: { patient_id: bigint; psychologist_id: bigint }
) {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  const actorId = toBigInt(actor.id);
  return actorId === c.patient_id || actorId === c.psychologist_id;
}

// ---------------- Handlers ----------------

// POST /consultations
export async function createConsultation(req: Request, res: Response) {
  try {
    const actor = (req as any).user;

    // Admin boleh membuatkan utk pasien lain via body.patient_id
    const patientId =
      actor.role === "admin" && req.body?.patient_id != null
        ? toBigInt(req.body.patient_id)
        : toBigInt(actor.id);

    // validasi & coerce ID psy di schema kamu (schema boleh terima string/number)
    const parsed = createConsultationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(422)
        .json({ error: { message: "Validation failed", issues: parsed.error.issues } });
    }
    const body = parsed.data;

    const psyId = toBigInt(body.psychologist_id);
    const psy = await prisma.psychologists.findUnique({ where: { id: psyId } });
    if (!psy) return res.status(404).json({ error: { message: "Psychologist not found" } });

    const start = new Date(body.scheduled_start_at);
    const end = new Date(body.scheduled_end_at);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
      return res.status(400).json({ error: { message: "Invalid schedule range" } });
    }

    // cek bentrok konsultasi psikolog (scheduled/ongoing)
    const existing = await prisma.consultations.findMany({
      where: {
        psychologist_id: psyId,
        status: { in: ["scheduled", "ongoing"] },
      },
      select: { scheduled_start_at: true, scheduled_end_at: true },
    });
    const isClash = existing.some((c) =>
      overlaps(start, end, c.scheduled_start_at, c.scheduled_end_at)
    );
    if (isClash) {
      return res.status(409).json({ error: { message: "Schedule conflict" } });
    }

    const price = body.channel === "chat" ? psy.price_chat : psy.price_video;

    const c = await prisma.consultations.create({
      data: {
        patient_id: patientId,
        psychologist_id: psyId,
        channel: body.channel,
        status: "scheduled",
        scheduled_start_at: start,
        scheduled_end_at: end,
        price: price ?? null,
        patient_notes: body.patient_notes,
      },
    });

    res.status(201).json({ consultation: c });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}

// GET /consultations (list milik user login)
export async function listMyConsultations(req: Request, res: Response) {
  try {
    const u = (req as any).user;
    const uid = toBigInt(u.id);

    const where =
      u.role === "psychologist"
        ? { psychologist_id: uid }
        : u.role === "patient"
        ? { patient_id: uid }
        : {};

    const items = await prisma.consultations.findMany({
      where,
      orderBy: { scheduled_start_at: "desc" },
      include: {
        patient: true,
        psychologist: { include: { user: true } },
        payments: true,
        review: true,
        stream_channel: true,
      },
    });

    res.json({ items });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}

// GET /consultations/:id
export async function getConsultationById(req: Request, res: Response) {
  try {
    if (!req.params.id)
      return res.status(400).json({ error: { message: "Consultation ID is required" } });

    const id = toBigInt(req.params.id);
    const c = await prisma.consultations.findUnique({
      where: { id },
      include: {
        patient: true,
        psychologist: { include: { user: true } },
        payments: true,
        review: true,
        stream_channel: true,
      },
    });
    if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

    const actor = (req as any).user;
    if (!canSeeConsultation(actor, c)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    res.json({ consultation: c });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}

// PUT /consultations/:id  (ubah status/jadwal) -> admin atau psy pemilik
// PUT /consultations/:id  (ubah status/jadwal) -> admin atau psy pemilik
export async function updateConsultation(req: Request, res: Response) {
  try {
    if (!req.params.id)
      return res.status(400).json({ error: { message: "Consultation ID is required" } });

    const id = toBigInt(req.params.id);
    const actor = (req as any).user;

    const current = await prisma.consultations.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: { message: "Consultation not found" } });

    const actorId = toBigInt(actor.id);
    if (
      actor.role !== "admin" &&
      !(actor.role === "psychologist" && actorId === current.psychologist_id)
    ) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const data: any = { updated_at: new Date() };

    // --- Validasi status HANYA kalau dikirim ---
    const statusVal = (req.body as any)?.status;
    if (statusVal !== undefined) {
      const parsed = StatusEnum.safeParse(statusVal);
      if (!parsed.success) {
        return res
          .status(422)
          .json({ error: { message: "Invalid status", issues: parsed.error.issues } });
      }
      data.status = parsed.data;
    }

    // --- Update jadwal (opsional) ---
    const { scheduled_start_at, scheduled_end_at } = req.body as {
      scheduled_start_at?: string;
      scheduled_end_at?: string;
    };

    if (scheduled_start_at || scheduled_end_at) {
      const start = new Date(scheduled_start_at ?? current.scheduled_start_at);
      const end = new Date(scheduled_end_at ?? current.scheduled_end_at);
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return res.status(400).json({ error: { message: "Invalid schedule range" } });
      }

      // cek bentrok (exclude current id)
      const existing = await prisma.consultations.findMany({
        where: {
          id: { not: id },
          psychologist_id: current.psychologist_id,
          status: { in: ["scheduled", "ongoing"] },
        },
        select: { scheduled_start_at: true, scheduled_end_at: true },
      });
      const isClash = existing.some((c) =>
        overlaps(start, end, c.scheduled_start_at, c.scheduled_end_at)
      );
      if (isClash) {
        return res.status(409).json({ error: { message: "Schedule conflict" } });
      }

      data.scheduled_start_at = start;
      data.scheduled_end_at = end;
    }

    const updated = await prisma.consultations.update({ where: { id }, data });
    res.json({ consultation: updated });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}


// DELETE /consultations/:id  -> admin atau patient pemilik
export async function cancelConsultation(req: Request, res: Response) {
  try {
    if (!req.params.id)
      return res.status(400).json({ error: { message: "Consultation ID is required" } });

    const id = toBigInt(req.params.id);
    const actor = (req as any).user;

    const c = await prisma.consultations.findUnique({ where: { id } });
    if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

    const actorId = toBigInt(actor.id);
    if (!(actor.role === "admin" || actorId === c.patient_id)) {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const updated = await prisma.consultations.update({
      where: { id },
      data: { status: "cancelled", updated_at: new Date() },
    });
    res.json({ consultation: updated });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}
