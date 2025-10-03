import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
import { upsertPsychologistSchema } from "../validators/psychilogist.schema.js";

// GET /psychologists
export async function listPsychologists(req: Request, res: Response) {
  const { q, specialty_id, sort } = req.query as {
    q?: string;
    specialty_id?: string;
    sort?: "price_chat_asc" | "price_chat_desc" | "rating_desc" | "rating_asc" | "created_desc" | "created_asc";
  };

  const where: Prisma.psychologistsWhereInput = {};
  if (q) where.user = { full_name: { contains: q, mode: "insensitive" } };
  if (specialty_id) where.specialties = { some: { specialty_id: BigInt(specialty_id) } };

  let orderBy: Prisma.psychologistsOrderByWithRelationInput;
  switch (sort) {
    case "price_chat_asc": orderBy = { price_chat: Prisma.SortOrder.asc }; break;
    case "price_chat_desc": orderBy = { price_chat: Prisma.SortOrder.desc }; break;
    case "rating_desc": orderBy = { rating_avg: Prisma.SortOrder.desc }; break;
    case "rating_asc": orderBy = { rating_avg: Prisma.SortOrder.asc }; break;
    case "created_asc": orderBy = { created_at: Prisma.SortOrder.asc }; break;
    case "created_desc":
    default: orderBy = { created_at: Prisma.SortOrder.desc };
  }

  const items = await prisma.psychologists.findMany({
    where,
    orderBy,
    include: {
      user: true,
      specialties: { include: { specialty: true } }
    }
  });
  res.json({ items });
}

// GET /psychologists/:id
export async function getPsychologistById(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const doc = await prisma.psychologists.findUnique({
    where: { id },
    include: {
      user: true,
      specialties: { include: { specialty: true } }
    }
  });
  if (!doc) return res.status(404).json({ error: { message: "Psychologist not found" } });
  res.json({ psychologist: doc });
}

// POST /psychologists  (admin)
export async function adminCreatePsychologist(req: Request, res: Response) {
  // Admin membuat psikolog baru dari existing user, atau sekalian create user?
  // Di sini: require `user_id` existing
  const { user_id } = req.body as { user_id: string };
  if (!user_id) return res.status(400).json({ error: { message: "user_id is required" } });
  const uid = BigInt(user_id);

  // pastikan user ada
  const user = await prisma.users.findUnique({ where: { id: uid } });
  if (!user) return res.status(404).json({ error: { message: "User not found" } });

  // upsert psikolog
  const psy = await prisma.psychologists.upsert({
    where: { id: uid },
    update: {},
    create: { id: uid }
  });

  // pastikan role user = psychologist
  if (user.role !== "psychologist") {
    await prisma.users.update({ where: { id: uid }, data: { role: "psychologist" } });
  }

  res.status(201).json({ psychologist: psy });
}

// PUT /psychologists/:id (admin atau owner)
export async function updatePsychologistById(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  if (actor.role !== "admin" && !(actor.role === "psychologist" && actor.id === id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const body = upsertPsychologistSchema.parse(req.body);

  await prisma.psychologists.update({
    where: { id },
    data: {
      license_no: body.license_no,
      bio: body.bio,
      price_chat: body.price_chat ?? undefined,
      price_video: body.price_video ?? undefined,
      updated_at: new Date()
    }
  });

  if (body.specialties) {
    await prisma.psychologist_specialties.deleteMany({ where: { psychologist_id: id } });
    await prisma.psychologist_specialties.createMany({
      data: body.specialties.map((sid) => ({
        psychologist_id: id,
        specialty_id: BigInt(sid)
      })), skipDuplicates: true
    });
  }

  const doc = await prisma.psychologists.findUnique({
    where: { id },
    include: {
      user: true,
      specialties: { include: { specialty: true } }
    }
  });
  res.json({ psychologist: doc });
}

// GET /psychologists/:id/reviews
export async function listPsychologistReviews(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const items = await prisma.reviews.findMany({
    where: { psychologist_id: id },
    orderBy: { created_at: "desc" },
    include: {
      patient: { select: { id: true, full_name: true } },
      consultation: { select: { id: true, channel: true, scheduled_start_at: true } }
    }
  });
  res.json({ items });
}

// GET /psychologists/:id/availabilities
export async function listPsychologistAvailabilities(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const items = await prisma.availabilities.findMany({
    where: { psychologist_id: id },
    orderBy: [{ weekday: "asc" }, { start_time: "asc" }]
  });
  res.json({ items });
}
