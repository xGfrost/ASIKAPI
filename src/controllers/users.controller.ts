// src/controllers/users.controller.ts
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import {
  listUsersQuerySchema,
  updateUserSchema,
} from "../validators/user.schema.js";
import { parsePagination, withPagination } from "../utils/pagination.js";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

/** ======================
 *  Types (DTO & Response)
 * =======================*/

type ErrorResponse = { error: { message: string; issues?: unknown } };

type PsychologistDTO = {
  id: string;
  license_no: string | null;
  bio: string | null;
  price_chat: number | null;
  price_video: number | null;
  rating_avg: number | null;
  rating_count: number;
  created_at: string;
  updated_at: string | null;
};

type UserDTO = {
  id: string;
  role: "patient" | "psychologist" | "admin";
  full_name: string;
  image: string;
  email: string;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null; // ISO
  created_at: string;           // ISO
  updated_at: string | null;    // ISO
  psychologist?: PsychologistDTO | null;
};

type MeResponse = { user: UserDTO | null };
type GetUserResponse = { user: UserDTO };
type DeleteUserResponse = { ok: true };

// Generic paginated response already formed by withPagination<T>
type Paginated<T> = {
  items: T[];
  page: number;
  limit: number;
  total: number;
  has_next: boolean;
  has_prev: boolean;
};

/** ======================
 *  Helpers
 * =======================*/

const isProd = process.env.NODE_ENV === "production";

const toISO = (d?: Date | null) => (d ? d.toISOString() : null);

// Prisma.Decimal → number (aman untuk uang sederhana)
const dec = (v: Prisma.Decimal | number | null | undefined) =>
  v == null ? null : Number(v);

// sembunyikan password dari objek Prisma
function stripPassword<T extends { password?: string | null }>(u: T | null) {
  if (!u) return u;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = u as any;
  return rest;
}

function isDbConnError(err: unknown) {
  const e = err as any;
  const msg: string = e?.message ?? "";
  return (
    e instanceof Prisma.PrismaClientInitializationError ||
    /Can't reach database server|ECONNREFUSED|ENOTFOUND|connection timed out|Connection terminated/i.test(
      msg
    )
  );
}

function handleError(
  res: Response<ErrorResponse>,
  err: unknown,
  fallbackMsg = "Internal server error"
) {
  if (!isProd) console.error(err);
  if (err instanceof ZodError) {
    return res
      .status(422)
      .json({ error: { message: "Validation failed", issues: err.issues } });
  }
  if (isDbConnError(err)) {
    return res.status(503).json({ error: { message: "Database unavailable" } });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002")
      return res
        .status(409)
        .json({ error: { message: "Conflict: unique constraint" } });
    if (err.code === "P2025")
      return res.status(404).json({ error: { message: "Record not found" } });
    if (err.code === "P2003")
      return res
        .status(409)
        .json({ error: { message: "Constraint violation" } });
  }
  return res.status(500).json({ error: { message: fallbackMsg } });
}

// Map psychologists → DTO
function toPsychologistDTO(
  p: Prisma.psychologistsGetPayload<{}>
): PsychologistDTO {
  return {
    id: p.id,
    license_no: p.license_no ?? null,
    bio: p.bio ?? null,
    price_chat: dec(p.price_chat),
    price_video: dec(p.price_video),
    rating_avg: dec(p.rating_avg),
    rating_count: p.rating_count,
    created_at: p.created_at.toISOString(),
    updated_at: toISO(p.updated_at),
  };
}

// Map users (plus psychologist include) → DTO
type UserWithPsy =
  Prisma.usersGetPayload<{ include: { psychologist: true } }>;

function toUserDTO(u: UserWithPsy | null): UserDTO | null {
  if (!u) return null;
  const safe = stripPassword(u)! as UserWithPsy;
  return {
    id: safe.id,
    role: safe.role,
    full_name: safe.full_name,
    image: safe.image,
    email: safe.email,
    phone: safe.phone ?? null,
    gender: safe.gender ?? null,
    date_of_birth: toISO(safe.date_of_birth),
    created_at: safe.created_at.toISOString(),
    updated_at: toISO(safe.updated_at),
    psychologist: safe.psychologist ? toPsychologistDTO(safe.psychologist) : null,
  };
}

/** ======================
 *  Controllers
 * =======================*/

export async function me(
  req: Request,
  res: Response<MeResponse | ErrorResponse>
) {
  try {
    const u = (req as any).user;
    if (!u?.id)
      return res.status(401).json({ error: { message: "Unauthorized" } });

    const data = await prisma.users.findUnique({
      where: { id: u.id as string },
      include: { psychologist: true },
    });

    return res.json({ user: toUserDTO(data) });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateMe(
  req: Request,
  res: Response<GetUserResponse | ErrorResponse>
) {
  try {
    const uid: string | undefined = (req as any).user?.id;
    if (!uid)
      return res.status(401).json({ error: { message: "Unauthorized" } });

    const body = updateUserSchema.parse(req.body);
    const data: Prisma.usersUpdateInput = {
      // hanya field2 yang diizinkan oleh schema
      full_name: body.full_name ?? undefined,
      image: body.image ?? undefined,
      phone: body.phone ?? undefined,
      gender: body.gender ?? undefined,
      date_of_birth: body.date_of_birth
        ? new Date(body.date_of_birth)
        : undefined,
      updated_at: new Date(),
    };

    const user = await prisma.users.update({
      where: { id: uid },
      data,
      include: { psychologist: true },
    });

    return res.json({ user: toUserDTO(user)! });
  } catch (err) {
    return handleError(res, err, "Failed to update profile");
  }
}

// Admin-only
export async function adminListUsers(
  req: Request,
  res: Response<Paginated<UserDTO> | ErrorResponse>
) {
  try {
    const q = listUsersQuerySchema.parse(req.query);
    const { page, limit, skip, take } = parsePagination(q);

    const where: Prisma.usersWhereInput = {};
    if (q.q) {
      where.OR = [
        { full_name: { contains: q.q, mode: "insensitive" } },
        { email: { contains: q.q, mode: "insensitive" } },
      ];
    }
    if (q.role) where.role = q.role as any;

    let orderBy: Prisma.usersOrderByWithRelationInput;
    switch (q.sort) {
      case "created_asc":
        orderBy = { created_at: Prisma.SortOrder.asc };
        break;
      case "name_asc":
        orderBy = { full_name: Prisma.SortOrder.asc };
        break;
      case "name_desc":
        orderBy = { full_name: Prisma.SortOrder.desc };
        break;
      case "created_desc":
      default:
        orderBy = { created_at: Prisma.SortOrder.desc };
        break;
    }

    const [total, rows] = await Promise.all([
      prisma.users.count({ where }),
      prisma.users.findMany({
        where,
        orderBy,
        skip,
        take,
        include: { psychologist: true },
      }),
    ]);

    const items = rows.map(toUserDTO) as UserDTO[];
    return res.json(withPagination(items, total, page, limit));
  } catch (err) {
    return handleError(res, err, "Failed to list users");
  }
}

export async function adminGetUser(
  req: Request,
  res: Response<GetUserResponse | ErrorResponse>
) {
  try {
    const idParam = req.params.id;
    if (!idParam)
      return res
        .status(400)
        .json({ error: { message: "User ID is required" } });
    const id = String(idParam);

    const user = await prisma.users.findUnique({
      where: { id },
      include: { psychologist: true },
    });
    if (!user)
      return res.status(404).json({ error: { message: "User not found" } });

    return res.json({ user: toUserDTO(user)! });
  } catch (err) {
    return handleError(res, err, "Failed to get user");
  }
}

export async function adminDeleteUser(
  req: Request,
  res: Response<DeleteUserResponse | ErrorResponse>
) {
  try {
    const idParam = req.params.id;
    if (!idParam)
      return res
        .status(400)
        .json({ error: { message: "User ID is required" } });
    const id = String(idParam);

    // Kumpulkan semua consultations (sebagai patient atau psychologist)
    const cons = await prisma.consultations.findMany({
      where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      select: { id: true },
    });
    const consIds = cons.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      // 1) Hapus entitas bergantung consultation_id
      if (consIds.length > 0) {
        await tx.stream_channels.deleteMany({
          where: { consultation_id: { in: consIds } },
        });
        await tx.payments.deleteMany({
          where: { consultation_id: { in: consIds } },
        });
        await tx.ai_consultation_notes.deleteMany({
          where: { consultation_id: { in: consIds } },
        });
        await tx.reviews.deleteMany({
          where: { consultation_id: { in: consIds } },
        });

        // Hapus AI intake analysis untuk intake_forms dari consultations ini
        await tx.ai_intake_analysis.deleteMany({
          where: { intake_form: { is: { consultation_id: { in: consIds } } } },
        });

        // Baru hapus intake forms yang terkait consultations
        await tx.intake_forms.deleteMany({
          where: { consultation_id: { in: consIds } },
        });
      }

      // 2) Hapus yang terkait langsung via patient/psychologist (bukan lewat consultation)
      await tx.reviews.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // Hapus AI intake analysis untuk intake_forms milik user ini
      await tx.ai_intake_analysis.deleteMany({
        where: {
          intake_form: {
            is: { OR: [{ patient_id: id }, { psychologist_id: id }] },
          },
        },
      });
      await tx.intake_forms.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // 3) Hapus consultations terakhir
      await tx.consultations.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // 4) Jika user adalah psikolog, bersihkan resource psikolog
      await tx.psychologist_specialties.deleteMany({
        where: { psychologist_id: id },
      });
      await tx.availabilities.deleteMany({ where: { psychologist_id: id } });
      await tx.psychologists.deleteMany({ where: { id } });

      // 5) Terakhir, hapus user
      await tx.users.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err, "Failed to delete user");
  }
}
