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

// ===== helpers =====
const isProd = process.env.NODE_ENV === "production";

function toSafeUser<T extends { password?: string | null }>(u: T | null) {
  if (!u) return u;
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
  res: Response,
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

// ===== controllers =====

export async function me(req: Request, res: Response) {
  try {
    const u = (req as any).user;
    if (!u?.id)
      return res.status(401).json({ error: { message: "Unauthorized" } });

    const data = await prisma.users.findUnique({
      where: { id: u.id },
      include: { psychologist: true },
    });

    return res.json({ user: toSafeUser(data) });
  } catch (err) {
    return handleError(res, err);
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const uid: string = (req as any).user?.id;
    if (!uid)
      return res.status(401).json({ error: { message: "Unauthorized" } });

    const body = updateUserSchema.parse(req.body);
    const data: any = { ...body };
    if (body.date_of_birth) data.date_of_birth = new Date(body.date_of_birth);

    const user = await prisma.users.update({ where: { id: uid }, data });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    return handleError(res, err, "Failed to update profile");
  }
}

// Admin-only
export async function adminListUsers(req: Request, res: Response) {
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
      prisma.users.findMany({ where, orderBy, skip, take }),
    ]);

    const safeRows = rows.map(toSafeUser);
    return res.json(withPagination(safeRows, total, page, limit));
  } catch (err) {
    return handleError(res, err, "Failed to list users");
  }
}

export async function adminGetUser(req: Request, res: Response) {
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

    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    return handleError(res, err, "Failed to get user");
  }
}

export async function adminDeleteUser(req: Request, res: Response) {
  try {
    const idParam = req.params.id;
    if (!idParam)
      return res
        .status(400)
        .json({ error: { message: "User ID is required" } });
    const id = String(idParam);

    // Ambil semua consultation yang terkait (sebagai patient atau psychologist)
    const cons = await prisma.consultations.findMany({
      where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      select: { id: true },
    });
    const consIds = cons.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      // 1) Hapus entitas yang bergantung pada consultation_id
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

        // Hapus AI intake analysis untuk intake forms dari consultations ini
        await tx.ai_intake_analysis.deleteMany({
          where: { intake_form: { is: { consultation_id: { in: consIds } } } },
        });
        // Baru hapus intake forms-nya
        await tx.intake_forms.deleteMany({
          where: { consultation_id: { in: consIds } },
        });
      }

      // 2) Hapus yang terkait langsung via patient/psychologist (bukan lewat consultation di atas)
      await tx.reviews.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // Catatan: ai_consultation_notes sudah dihapus via consultation_id.
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

      // 5) Terakhir: hapus user
      await tx.users.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (err) {
    return handleError(res, err, "Failed to delete user");
  }
}
