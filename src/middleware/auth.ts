import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

export interface JwtUser {
  id: bigint;
  role: "patient" | "psychologist" | "admin";
  email: string;
}

export function signJwt(payload: Omit<JwtUser, "id"> & { id: bigint }) {
  const secret = process.env.JWT_SECRET!;
  return jwt.sign(
    { ...payload, id: payload.id.toString() },
    secret,
    { expiresIn: "7d" }
  );
}

export function requireAuth(roles?: Array<JwtUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (!token) return res.status(401).json({ error: { message: "Unauthorized" } });
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      (req as any).user = {
        id: BigInt(decoded.id),
        role: decoded.role,
        email: decoded.email
      } as JwtUser;
      if (roles && !roles.includes((req as any).user.role)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: { message: "Unauthorized" } });
    }
  };
}
