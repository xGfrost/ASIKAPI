// src/controllers/users.controller.ts
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { listUsersQuerySchema, updateUserSchema } from "../validators/user.schema.js";
import { parsePagination, withPagination } from "../utils/pagination.js";
import { Prisma } from "@prisma/client";

// helper: sembunyikan password
function toSafeUser<T extends { password?: string | null }>(u: T | null) {
  if (!u) return u;
  const { password, ...rest } = u as any;
  return rest;
}

// helper: klasifikasikan error koneksi DB
function isDbConnError(err: unknown) {
  const msg = (err as any)?.message as string | undefined;
  return !!msg && msg.includes("Can't reach database server");
}

export async function me(req: Request, res: Response) {
  try {
    const u = (req as any).user;
    const data = await prisma.users.findUnique({
      where: { id: u.id },
      include: { psychologist: true },
    });
    return res.json({ user: toSafeUser(data) });
  } catch (err) {
    if (isDbConnError(err)) {
      return res.status(503).json({ error: { message: "Database unavailable" } });
    }
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}

export async function updateMe(req: Request, res: Response) {
  try {
    const uid: bigint = (req as any).user.id;
    const body = updateUserSchema.parse(req.body);
    const data: any = { ...body };
    if (body.date_of_birth) data.date_of_birth = new Date(body.date_of_birth);

    const user = await prisma.users.update({ where: { id: uid }, data });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    if (isDbConnError(err)) {
      return res.status(503).json({ error: { message: "Database unavailable" } });
    }
    return res.status(500).json({ error: { message: "Internal server error" } });
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

    // sembunyikan password di list
    const safeRows = rows.map((u) => toSafeUser(u));
    return res.json(withPagination(safeRows, total, page, limit));
  } catch (err) {
    if (isDbConnError(err)) {
      return res.status(503).json({ error: { message: "Database unavailable" } });
    }
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}

export async function adminGetUser(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: { message: "User ID is required" } });
    }
    const id = BigInt(req.params.id);
    const user = await prisma.users.findUnique({
      where: { id },
      include: { psychologist: true },
    });
    if (!user) return res.status(404).json({ error: { message: "User not found" } });
    return res.json({ user: toSafeUser(user) });
  } catch (err) {
    if (isDbConnError(err)) {
      return res.status(503).json({ error: { message: "Database unavailable" } });
    }
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}

export async function adminDeleteUser(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res.status(400).json({ error: { message: "User ID is required" } });
    }
    const id = BigInt(req.params.id);

    // Ambil semua consultation yang terkait (sebagai patient atau psychologist)
    const consultations = await prisma.consultations.findMany({
      where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      select: { id: true },
    });
    const consIds = consultations.map((c) => c.id);

    await prisma.$transaction(async (tx) => {
      // Hapus entitas berbasis consultation_id terlebih dulu
      if (consIds.length > 0) {
        await tx.stream_channels.deleteMany({ where: { consultation_id: { in: consIds } } });
        await tx.payments.deleteMany({ where: { consultation_id: { in: consIds } } });
        await tx.ai_consultation_notes.deleteMany({ where: { consultation_id: { in: consIds } } });
        await tx.intake_forms.deleteMany({ where: { consultation_id: { in: consIds } } });
        await tx.reviews.deleteMany({ where: { consultation_id: { in: consIds } } });
      }

      // Hapus review lain yang terkait langsung (sebagai patient/psychologist)
      await tx.reviews.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // Hapus intake forms/ai notes yang terkait langsung via patient/psychologist (jaga-jaga)
      await tx.intake_forms.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });
      await tx.ai_consultation_notes.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // Hapus consultations terakhir
      await tx.consultations.deleteMany({
        where: { OR: [{ patient_id: id }, { psychologist_id: id }] },
      });

      // Jika user adalah psikolog, bersihkan resource psikolog
      await tx.psychologist_specialties.deleteMany({ where: { psychologist_id: id } });
      await tx.availabilities.deleteMany({ where: { psychologist_id: id } });
      await tx.psychologists.deleteMany({ where: { id } });

      // Terakhir: hapus user
      await tx.users.delete({ where: { id } });
    });

    return res.json({ ok: true });
  } catch (err) {
    if (isDbConnError(err)) {
      return res.status(503).json({ error: { message: "Database unavailable" } });
    }
    return res.status(500).json({ error: { message: "Internal server error" } });
  }
}
