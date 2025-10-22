import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
  createSpecialtySchema,
  assignSpecialtiesSchema,
} from "../validators/speciality.schema.js";

function toBigInt(x: number | string | string) {
  if (typeof x === "string") return x;
  if (typeof x === "number") return String(x);
  return String(x);
}

// GET /specialties
export async function listSpecialties(_req: Request, res: Response) {
  const items = await prisma.specialties.findMany({ orderBy: { name: "asc" } });
  res.json({ items });
}

// POST /specialties  (ADMIN)
export async function adminCreateSpecialty(req: Request, res: Response) {
  const parsed = createSpecialtySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: { message: "Validation failed", issues: parsed.error.issues },
    });
  }
  const { name } = parsed.data;

  const s = await prisma.specialties.create({ data: { name } });
  res.status(201).json({ specialty: s });
}

/**
 * POST /psychologists/:id/specialties
 * Body: { specialty_ids: number[] }
 * - Replace semua spesialisasi milik psikolog tsb
 * - Hanya admin / owner (psychologist yg sama id-nya) yg boleh
 */
export async function assignPsychologistSpecialties(
  req: Request,
  res: Response
) {
  const idParam = req.params.id;
  if (!idParam)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psychologistId = String(idParam);

  // auth: admin atau owner
  const actor = (req as any).user;
  if (!actor)
    return res.status(401).json({ error: { message: "Unauthorized" } });
  if (
    actor.role !== "admin" &&
    !(actor.role === "psychologist" && actor.id === psychologistId)
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const parsed = assignSpecialtiesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: { message: "Validation failed", issues: parsed.error.issues },
    });
  }

  // pastikan psikolog ada
  const psy = await prisma.psychologists.findUnique({
    where: { id: psychologistId },
  });
  if (!psy)
    return res
      .status(404)
      .json({ error: { message: "Psychologist not found" } });

  // validasi id spesialisasi yg ada (opsional tapi bagus)
  const ids = parsed.data.specialty_ids.map(toBigInt);
  const found = await prisma.specialties.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });
  const foundIds = new Set(found.map((s) => s.id.toString()));
  const missing = ids.filter((i) => !foundIds.has(i.toString()));
  if (missing.length > 0) {
    return res.status(400).json({
      error: { message: `Unknown specialty id(s): ${missing.join(", ")}` },
    });
  }

  // replace all
  await prisma.$transaction(async (tx) => {
    await tx.psychologist_specialties.deleteMany({
      where: { psychologist_id: psychologistId },
    });
    if (ids.length > 0) {
      await tx.psychologist_specialties.createMany({
        data: ids.map((sid) => ({
          psychologist_id: psychologistId,
          specialty_id: sid,
        })),
        skipDuplicates: true,
      });
    }
  });

  const doc = await prisma.psychologists.findUnique({
    where: { id: psychologistId },
    include: { specialties: { include: { specialty: true } } },
  });

  res.json({ psychologist: doc });
}

/**
 * DELETE /psychologists/:id/specialties/:sid
 */
export async function removePsychologistSpecialty(req: Request, res: Response) {
  const idParam = req.params.id;
  const sidParam = req.params.sid;
  if (!idParam || !sidParam) {
    return res.status(400).json({
      error: { message: "Psychologist ID and Specialty ID are required" },
    });
  }
  const psychologistId = String(idParam);
  const specialtyId = String(sidParam);

  const actor = (req as any).user;
  if (!actor)
    return res.status(401).json({ error: { message: "Unauthorized" } });
  if (
    actor.role !== "admin" &&
    !(actor.role === "psychologist" && actor.id === psychologistId)
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  await prisma.psychologist_specialties.deleteMany({
    where: { psychologist_id: psychologistId, specialty_id: specialtyId },
  });

  res.json({ ok: true });
}
