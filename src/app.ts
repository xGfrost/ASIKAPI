import express from "express";
import helmet from "helmet";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const compression = require("compression") as typeof import("compression");
const cors = require("cors") as typeof import("cors");
const morgan = require("morgan") as typeof import("morgan");



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
  app.use(helmet());
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/auth", authRoutes);
  app.use("/users", userRoutes);
  app.use("/psychologists", psychologistRoutes);
  app.use(consultationRoutes);         // base di file: /consultations
  app.use(streamRoutes);               // base di file: /consultations/:id/stream-channel
  app.use("/payments", paymentRoutes);
  app.use("/reviews", reviewRoutes);   // berisi endpoints berbasis /consultations/:id/reviews
  app.use("/specialties", specialtyRoutes);
  app.use(availabilityRoutes);         // /psychologists/:id/availabilities & /availabilities/:id

  app.use(intakeRoutes);
app.use(aiIntakeRoutes);
app.use(aiNotesRoutes);
app.use(dashboardRoutes);
app.use(utilitiesRoutes);

  app.use(errorHandler);
  return app;
}
