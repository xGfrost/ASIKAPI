import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

function canView(actor: any, c: { patient_id: bigint; psychologist_id: bigint }) {
  return actor.role === "admin" || actor.id === c.patient_id || actor.id === c.psychologist_id;
}

// POST /consultations/:id/intake-form
export async function createIntakeForm(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const cid = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({
    where: { id: cid },
    select: { patient_id: true, psychologist_id: true }
  });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });

  // Patient pemilik atau admin
  if (!(actor.role === "admin" || actor.id === c.patient_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { symptoms_text, duration_text, triggers_text, goals_text, additional_info } = req.body ?? {};

  const form = await prisma.intake_forms.upsert({
    where: { consultation_id: cid },
    update: {
      symptoms_text, duration_text, triggers_text, goals_text, additional_info, updated_at: new Date()
    },
    create: {
      consultation_id: cid,
      patient_id: c.patient_id,
      psychologist_id: c.psychologist_id,
      symptoms_text, duration_text, triggers_text, goals_text, additional_info
    }
  });

  res.status(201).json({ intake_form: form });
}

// GET /consultations/:id/intake-form
export async function getConsultationIntakeForm(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const cid = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({
    where: { id: cid },
    select: { patient_id: true, psychologist_id: true }
  });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });
  if (!canView(actor, c)) return res.status(403).json({ error: { message: "Forbidden" } });

  const form = await prisma.intake_forms.findUnique({ where: { consultation_id: cid } });
  if (!form) return res.status(404).json({ error: { message: "Intake form not found" } });

  res.json({ intake_form: form });
}

// PUT /consultations/:id/intake-form
export async function updateIntakeForm(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const cid = BigInt(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({
    where: { id: cid },
    select: { patient_id: true, psychologist_id: true }
  });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });
  if (!(actor.role === "admin" || actor.id === c.patient_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const { symptoms_text, duration_text, triggers_text, goals_text, additional_info } = req.body ?? {};

  const updated = await prisma.intake_forms.update({
    where: { consultation_id: cid },
    data: {
      symptoms_text, duration_text, triggers_text, goals_text, additional_info, updated_at: new Date()
    }
  });

  res.json({ intake_form: updated });
}

// GET /psychologists/:id/intake-forms
export async function listPsychologistIntakeForms(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const psyId = BigInt(req.params.id);
  const actor = (req as any).user;

  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === psyId)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const items = await prisma.intake_forms.findMany({
    where: { psychologist_id: psyId },
    orderBy: { created_at: "desc" }
  });
  res.json({ items });
}
