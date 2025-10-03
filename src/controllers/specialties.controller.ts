import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

export async function listSpecialties(_req: Request, res: Response) {
  const items = await prisma.specialties.findMany({ orderBy: { name: "asc" } });
  res.json({ items });
}

export async function adminCreateSpecialty(req: Request, res: Response) {
  const { name } = req.body as { name: string };
  if (!name) return res.status(400).json({ error: { message: "name is required" } });

  const s = await prisma.specialties.create({ data: { name } });
  res.status(201).json({ specialty: s });
}

// POST /psychologists/:id/specialties { specialty_ids: number[] }
export async function assignPsychologistSpecialties(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const { specialty_ids } = req.body as { specialty_ids: Array<string | number> };
  if (!Array.isArray(specialty_ids) || specialty_ids.length === 0) {
    return res.status(400).json({ error: { message: "specialty_ids is required" } });
  }

  await prisma.psychologist_specialties.deleteMany({ where: { psychologist_id: id } });
  await prisma.psychologist_specialties.createMany({
    data: specialty_ids.map((sid) => ({
      psychologist_id: id,
      specialty_id: BigInt(sid as any)
    })), skipDuplicates: true
  });

  const doc = await prisma.psychologists.findUnique({
    where: { id },
    include: { specialties: { include: { specialty: true } } }
  });

  res.json({ psychologist: doc });
}

// DELETE /psychologists/:id/specialties/:sid
export async function removePsychologistSpecialty(req: Request, res: Response) {
    if (!req.params.id || !req.params.sid) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const sid = BigInt(req.params.sid);

  await prisma.psychologist_specialties.deleteMany({
    where: { psychologist_id: id, specialty_id: sid }
  });

  res.json({ ok: true });
}
