// src/controllers/users.controller.ts
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { listUsersQuerySchema, updateUserSchema } from "../validators/user.schema.js";
import { parsePagination, withPagination } from "../utils/pagination.js";
import { Prisma } from "@prisma/client"; // ⬅️ tambahkan ini

export async function me(req: Request, res: Response) {
  const u = (req as any).user;
  const data = await prisma.users.findUnique({
    where: { id: u.id },
    include: { psychologist: true }
  });
  res.json({ user: data });
}

export async function updateMe(req: Request, res: Response) {
  const uid: bigint = (req as any).user.id;
  const body = updateUserSchema.parse(req.body);
  const data: any = { ...body };
  if (body.date_of_birth) data.date_of_birth = new Date(body.date_of_birth);

  const user = await prisma.users.update({ where: { id: uid }, data });
  res.json({ user });
}

// Admin-only
export async function adminListUsers(req: Request, res: Response) {
  const q = listUsersQuerySchema.parse(req.query);
  const { page, limit, skip, take } = parsePagination(q);

  const where: Prisma.usersWhereInput = {};
  if (q.q) {
    where.OR = [
      { full_name: { contains: q.q, mode: "insensitive" } },
      { email: { contains: q.q, mode: "insensitive" } }
    ];
  }
  if (q.role) where.role = q.role as any;

  // ⬇️ Kunci tipe orderBy dan gunakan Prisma.SortOrder.*
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
    prisma.users.findMany({ where, orderBy, skip, take })
  ]);

  res.json(withPagination(rows, total, page, limit));
}

export async function adminGetUser(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  const user = await prisma.users.findUnique({
    where: { id },
    include: { psychologist: true }
  });
  if (!user) return res.status(404).json({ error: { message: "User not found" } });
  res.json({ user });
}

export async function adminDeleteUser(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });

  const id = BigInt(req.params.id);
  await prisma.reviews.deleteMany({ where: { patient_id: id } }).catch(() => {});
  await prisma.intake_forms.deleteMany({ where: { patient_id: id } }).catch(() => {});
  await prisma.consultations.deleteMany({ where: { patient_id: id } }).catch(() => {});
  await prisma.psychologist_specialties.deleteMany({ where: { psychologist_id: id } }).catch(() => {});
  await prisma.availabilities.deleteMany({ where: { psychologist_id: id } }).catch(() => {});
  await prisma.psychologists.deleteMany({ where: { id } }).catch(() => {});
  await prisma.users.delete({ where: { id } });
  res.json({ ok: true });
}
