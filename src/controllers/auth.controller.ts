import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { registerSchema, loginSchema } from "../validators/auth.schema.js";
import { hash, compare } from "../utils/hash.js";
import { signJwt } from "../middleware/auth.js";

export async function register(req: Request, res: Response) {
  const body = registerSchema.parse(req.body);

  // Force default role patient jika tidak diberikan
  const role = body.role ?? "patient";

  const exists = await prisma.users.findUnique({ where: { email: body.email }});
  if (exists) return res.status(409).json({ error: { message: "Email already used" }});

  const passwordHash = body.password ? await hash(body.password) : null;
  const user = await prisma.users.create({
    data: {
      full_name: body.full_name,
      email: body.email,
      password: passwordHash,
      role,
      phone: body.phone,
      gender: body.gender,
      date_of_birth: body.date_of_birth ? new Date(body.date_of_birth) : null
    }
  });

  if (role === "psychologist") {
    await prisma.psychologists.create({ data: { id: user.id } });
  }

  const token = signJwt({ id: user.id, role: user.role, email: user.email });
  return res.status(201).json({ token, user });
}

export async function login(req: Request, res: Response) {
  const body = loginSchema.parse(req.body);
  const user = await prisma.users.findUnique({ where: { email: body.email }});
  if (!user || !user.password) return res.status(401).json({ error: { message: "Invalid credentials" }});
  const ok = await compare(body.password, user.password);
  if (!ok) return res.status(401).json({ error: { message: "Invalid credentials" }});
  const token = signJwt({ id: user.id, role: user.role, email: user.email });
  res.json({ token, user });
}
