// src/app.ts
import express from "express";
import { createRequire } from "node:module";

// --- CJS packages via require (aman di ESM/NodeNext)
const require = createRequire(import.meta.url);
const compression = require("compression") as typeof import("compression");
const cors = require("cors") as typeof import("cors");
const morgan = require("morgan") as typeof import("morgan");

// --- Helmet: tahan banting untuk ESM/CJS perbedaan typings
import * as helmetModule from "helmet";
// ambil default jika tersedia, fallback ke modulnya sendiri
const helmet: (options?: any) => import("express").RequestHandler =
  ((helmetModule as any).default ?? (helmetModule as any));

// --- Local imports (pakai .js karena NodeNext)
import { errorHandler } from "./middleware/error.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.routes.js";
import psychologistRoutes from "./routes/psychologists.routes.js";
import consultationRoutes from "./routes/consultations.routes.js";
import streamRoutes from "./routes/stream_channels.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import reviewRoutes from "./routes/reviews.routes.js";
import specialtyRoutes from "./routes/specialties.routes.js";
import availabilityRoutes from "./routes/availabilities.routes.js";
import intakeRoutes from "./routes/intake_forms.routes.js";
import aiIntakeRoutes from "./routes/ai_intake.routes.js";
import aiNotesRoutes from "./routes/ai_notes.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import utilitiesRoutes from "./routes/utilities.route.js";

export function makeApp() {
  const app = express();

  app.use(cors());
  app.use(helmet()); // ✅ sekarang callable di Vercel
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);
  app.use("/psychologists", psychologistRoutes);
  app.use(consultationRoutes);
  app.use(streamRoutes);
  app.use("/payments", paymentRoutes);
  app.use(reviewRoutes); // ⬅️ tidak ada prefix supaya path-nya persis seperti requirement
  app.use(specialtyRoutes);
  app.use(availabilityRoutes);
  app.use(intakeRoutes);
  app.use(aiIntakeRoutes);
  app.use(aiNotesRoutes);
  app.use(dashboardRoutes);
  app.use(utilitiesRoutes);

  app.use(errorHandler);
  return app;
}

const app = makeApp();
export default app;
