import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { authSchema } from "../validators/auth.schema.js";
import { signJwt } from "../middleware/auth.js";

// Login-or-register by email only
export async function auth(req: Request, res: Response) {
  const { email, full_name, phone } = authSchema.parse(req.body);

  // Try to find existing user
  const existing = await prisma.users.findUnique({ where: { email } });
  if (existing) {
    const token = signJwt({
      id: existing.id,
      role: existing.role,
      email: existing.email,
    });
    return res.json({ token, user: existing });
  }

  const newUser = await prisma.users.create({
    data: {
      email,
      full_name,
      phone,
      role: "patient",
    },
  });

  const token = signJwt({
    id: newUser.id,
    role: newUser.role,
    email: newUser.email,
  });
  return res.status(201).json({ token, user: newUser });
}
