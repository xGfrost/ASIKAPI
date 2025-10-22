import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { Prisma } from "@prisma/client";
// Jika nama file kamu "psychologist.schema.ts", ganti baris di bawah:
import { upsertPsychologistSchema } from "../validators/psychilogist.schema.js";
import { z } from "zod";
import { hash } from "../utils/hash.js";

// ========== Helpers ==========
function toBigInt(v: string | number | string) {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return String(v);
}

// Schema khusus endpoint ADMIN create (boleh user_id ATAU user)
const adminCreatePsychologistSchema = z
  .object({
    user_id: z.union([z.string(), z.number()]).optional(),
    user: z
      .object({
        full_name: z.string().min(1),
        image: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6).optional(),
        phone: z.string().optional(),
        gender: z.string().optional(),
        date_of_birth: z.string().optional(), // YYYY-MM-DD
      })
      .optional(),
    license_no: z.string().optional(),
    bio: z.string().optional(),
    price_chat: z.number().optional(),
    price_video: z.number().optional(),
    specialty_ids: z.array(z.union([z.string(), z.number()])).optional(),
  })
  .refine((v) => !!v.user_id || !!v.user, {
    message: "Provide either user_id or user",
    path: ["user"],
  });

// ========== Controllers ==========

export interface ListPsychologistsQuery {
  q?: string;
  specialty_id?: string;
  sort?:
    | "price_chat_asc"
    | "price_chat_desc"
    | "rating_desc"
    | "rating_asc"
    | "created_desc"
    | "created_asc";
}

// GET /psychologists
export interface PsychologistResponse {
  id: string;
  license_no?: string | null;
  bio?: string | null;
  price_chat?: string | null;
  price_video?: string | null;
  rating_avg?: string | null;
  rating_count: number;
  created_at: Date;
  updated_at?: Date | null;
  user: {
    id: string;
    full_name: string;
    image: string;
    email: string;
    gender?: string | null;
  };
  specialties: {
    specialty: {
      id: string;
      name: string;
    };
  }[];
}

/**
 * List psychologists with filtering, sorting, and search.
 */
export async function listPsychologists(
  req: Request<unknown, unknown, unknown, ListPsychologistsQuery>,
  res: Response<{ items: PsychologistResponse[] }>
): Promise<void> {
  try {
    const { q, specialty_id, sort } = req.query;

    const where: Prisma.psychologistsWhereInput = {};
    if (q) {
      where.user = {
        full_name: { contains: q, mode: "insensitive" },
      };
    }

    if (specialty_id) {
      const specialtyIdNum = String(specialty_id);
      where.specialties = {
        some: { specialty_id: specialtyIdNum },
      };
    }

    let orderBy: Prisma.psychologistsOrderByWithRelationInput;
    switch (sort) {
      case "price_chat_asc":
        orderBy = { price_chat: "asc" };
        break;
      case "price_chat_desc":
        orderBy = { price_chat: "desc" };
        break;
      case "rating_desc":
        orderBy = { rating_avg: "desc" };
        break;
      case "rating_asc":
        orderBy = { rating_avg: "asc" };
        break;
      case "created_asc":
        orderBy = { created_at: "asc" };
        break;
      case "created_desc":
      default:
        orderBy = { created_at: "desc" };
    }

    const result = await prisma.psychologists.findMany({
      where,
      orderBy,
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            image: true,
            email: true,
            gender: true,
          },
        },
        specialties: {
          include: {
            specialty: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    const items: PsychologistResponse[] = result.map((r) => ({
      ...r,
      price_chat: r.price_chat ? r.price_chat.toString() : null,
      price_video: r.price_video ? r.price_video.toString() : null,
      rating_avg: r.rating_avg ? r.rating_avg.toString() : null,
    }));

    res.json({ items });
  } catch (error) {
    console.error("❌ listPsychologists error:", error);
    res.status(500).json({ items: [] });
  }
}

// GET /psychologists/:id
export async function getPsychologistById(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const id = String(req.params.id);

  const doc = await prisma.psychologists.findUnique({
    where: { id },
    include: {
      user: true,
      specialties: { include: { specialty: true } },
    },
  });
  if (!doc)
    return res
      .status(404)
      .json({ error: { message: "Psychologist not found" } });
  res.json({ psychologist: doc });
}

// POST /psychologists (ADMIN)
export async function adminCreatePsychologist(req: Request, res: Response) {
  const parsed = adminCreatePsychologistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: { message: "Validation failed", issues: parsed.error.issues },
    });
  }
  const body = parsed.data;

  // Dapatkan/buat user
  let uid: string;
  let userRecord: Prisma.PromiseReturnType<
    typeof prisma.users.findUnique
  > | null = null;

  await prisma.$transaction(async (tx) => {
    if (body.user_id) {
      // Flow A: pakai user_id yang sudah ada
      uid = toBigInt(body.user_id);
      userRecord = await tx.users.findUnique({ where: { id: uid } });
      if (!userRecord) throw new Error("USER_NOT_FOUND");
    } else if (body.user) {
      // Flow B: buat user baru (atau pakai yang sudah ada berdasarkan email)
      const existing = await tx.users.findUnique({
        where: { email: body.user.email },
      });
      if (existing) {
        uid = existing.id;
        userRecord = existing;
      } else {
        const passwordHash = body.user.password
          ? await hash(body.user.password)
          : null;
        const created = await tx.users.create({
          data: {
            role: "psychologist",
            full_name: body.user.full_name,
            image: body.user.image,
            email: body.user.email,
            password: passwordHash,
            phone: body.user.phone,
            gender: body.user.gender,
            date_of_birth: body.user.date_of_birth
              ? new Date(body.user.date_of_birth)
              : null,
          },
        });
        uid = created.id;
        userRecord = created;
      }
    } else {
      // seharusnya tak terjadi karena schema refine
      throw new Error("USER_ID_OR_USER_REQUIRED");
    }

    // Pastikan role psycholog
    if (userRecord!.role !== "psychologist") {
      await tx.users.update({
        where: { id: uid! },
        data: { role: "psychologist" },
      });
    }

    // Upsert psikolog + update field profil
    await tx.psychologists.upsert({
      where: { id: uid! },
      create: {
        id: uid!,
        license_no: body.license_no,
        bio: body.bio,
        price_chat: body.price_chat,
        price_video: body.price_video,
      },
      update: {
        license_no: body.license_no ?? undefined,
        bio: body.bio ?? undefined,
        price_chat: body.price_chat ?? undefined,
        price_video: body.price_video ?? undefined,
        updated_at: new Date(),
      },
    });

    // Atur specialties jika dikirim
    if (body.specialty_ids && body.specialty_ids.length > 0) {
      const ids = body.specialty_ids.map((s) => toBigInt(s));
      await tx.psychologist_specialties.deleteMany({
        where: { psychologist_id: uid! },
      });
      await tx.psychologist_specialties.createMany({
        data: ids.map((sid) => ({ psychologist_id: uid!, specialty_id: sid })),
        skipDuplicates: true,
      });
    }
  });

  const doc = await prisma.psychologists.findUnique({
    where: { id: userRecord!.id },
    include: {
      user: true,
      specialties: { include: { specialty: true } },
    },
  });

  return res.status(201).json({ psychologist: doc });
}

// PUT /psychologists/:id (admin atau owner)
export async function updatePsychologistById(req: Request, res: Response) {
  if (!req.params.id) {
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  }
  const id = String(req.params.id);
  const actor = (req as any).user;

  if (
    actor.role !== "admin" &&
    !(actor.role === "psychologist" && actor.id === id)
  ) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  // gunakan safeParse supaya gagal validasi -> 422, bukan error unhandled
  const parsed = upsertPsychologistSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      error: { message: "Validation failed", issues: parsed.error.issues },
    });
  }
  const body = parsed.data;

  await prisma.psychologists.update({
    where: { id },
    data: {
      license_no: body.license_no,
      bio: body.bio,
      price_chat: body.price_chat ?? undefined,
      price_video: body.price_video ?? undefined,
      updated_at: new Date(),
    },
  });

  if (body.specialties) {
    await prisma.psychologist_specialties.deleteMany({
      where: { psychologist_id: id },
    });
    const ids = body.specialties.map((sid) => toBigInt(sid));
    if (ids.length > 0) {
      await prisma.psychologist_specialties.createMany({
        data: ids.map((sid) => ({ psychologist_id: id, specialty_id: sid })),
        skipDuplicates: true,
      });
    }
  }

  const doc = await prisma.psychologists.findUnique({
    where: { id },
    include: {
      user: true,
      specialties: { include: { specialty: true } },
    },
  });

  return res.json({ psychologist: doc });
}

// GET /psychologists/:id/reviews
export async function listPsychologistReviews(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const id = String(req.params.id);
  const items = await prisma.reviews.findMany({
    where: { psychologist_id: id },
    orderBy: { created_at: "desc" },
    include: {
      patient: { select: { id: true, full_name: true } },
      consultation: {
        select: { id: true, channel: true, scheduled_start_at: true },
      },
    },
  });
  res.json({ items });
}

// GET /psychologists/:id/availabilities
export async function listPsychologistAvailabilities(
  req: Request,
  res: Response
) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const id = String(req.params.id);
  const items = await prisma.availabilities.findMany({
    where: { psychologist_id: id },
    orderBy: [{ weekday: "asc" }, { start_time: "asc" }],
  });
  res.json({ items });
}
