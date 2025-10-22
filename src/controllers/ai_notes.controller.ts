import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// POST /consultations/:id/ai-notes
export async function saveAiConsultationNotes(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });

  const cid = String(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({ where: { id: cid } });
  if (!c)
    return res
      .status(404)
      .json({ error: { message: "Consultation not found" } });

  if (
    actor.role !== "admin" &&
    !(actor.role === "psychologist" && actor.id === c.psychologist_id)
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const {
    notes_text,
    diarization_json,
    risk_analysis_json,
    mitigation_recommendations,
  } = req.body ?? {};

  const notes = await prisma.ai_consultation_notes.upsert({
    where: { consultation_id: cid },
    update: {
      notes_text,
      diarization_json,
      risk_analysis_json,
      mitigation_recommendations,
      updated_at: new Date(),
    },
    create: {
      consultation_id: cid,
      psychologist_id: c.psychologist_id,
      patient_id: c.patient_id,
      notes_text,
      diarization_json,
      risk_analysis_json,
      mitigation_recommendations,
    },
  });

  res.status(201).json({ ai_notes: notes });
}

// GET /consultations/:id/ai-notes
export async function getAiConsultationNotes(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });

  const cid = String(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({
    where: { id: cid },
    select: { patient_id: true, psychologist_id: true },
  });
  if (!c)
    return res
      .status(404)
      .json({ error: { message: "Consultation not found" } });

  if (
    !(
      actor.role === "admin" ||
      actor.id === c.patient_id ||
      actor.id === c.psychologist_id
    )
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const notes = await prisma.ai_consultation_notes.findUnique({
    where: { consultation_id: cid },
  });
  if (!notes)
    return res.status(404).json({ error: { message: "AI notes not found" } });

  res.json({ ai_notes: notes });
}

// PUT /consultations/:id/ai-notes
export async function updateAiConsultationNotes(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const cid = String(req.params.id);
  const actor = (req as any).user;

  const c = await prisma.consultations.findUnique({ where: { id: cid } });
  if (!c)
    return res
      .status(404)
      .json({ error: { message: "Consultation not found" } });

  if (
    actor.role !== "admin" &&
    !(actor.role === "psychologist" && actor.id === c.psychologist_id)
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const {
    notes_text,
    diarization_json,
    risk_analysis_json,
    mitigation_recommendations,
  } = req.body ?? {};

  const updated = await prisma.ai_consultation_notes.update({
    where: { consultation_id: cid },
    data: {
      notes_text,
      diarization_json,
      risk_analysis_json,
      mitigation_recommendations,
      updated_at: new Date(),
    },
  });

  res.json({ ai_notes: updated });
}
