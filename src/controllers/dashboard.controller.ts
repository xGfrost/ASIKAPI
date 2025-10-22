import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

function forbidIfNotOwnerOrAdmin(actor: any, psyId: string) {
  return !(
    actor.role === "admin" ||
    (actor.role === "psychologist" && actor.id === psyId)
  );
}

// GET /psychologists/:id/dashboard
export async function getPsychologistDashboard(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psyId = String(req.params.id);
  const actor = (req as any).user;
  if (forbidIfNotOwnerOrAdmin(actor, psyId))
    return res.status(403).json({ error: { message: "Forbidden" } });

  const now = new Date();

  const [totalPatients, upcomingCount, paidSum, pendingPayments] =
    await Promise.all([
      prisma.consultations
        .groupBy({
          by: ["patient_id"],
          where: { psychologist_id: psyId },
          _count: { patient_id: true },
        })
        .then((g) => g.length),
      prisma.consultations.count({
        where: {
          psychologist_id: psyId,
          scheduled_start_at: { gte: now },
          status: { in: ["scheduled", "ongoing"] },
        },
      }),
      prisma.payments
        .aggregate({
          _sum: { amount: true },
          where: { consultation: { psychologist_id: psyId }, status: "paid" },
        })
        .then((a) => a._sum.amount ?? 0),
      prisma.payments.count({
        where: { consultation: { psychologist_id: psyId }, status: "pending" },
      }),
    ]);

  res.json({
    dashboard: {
      total_unique_patients: totalPatients,
      upcoming_sessions: upcomingCount,
      total_paid_amount: paidSum,
      pending_payments: pendingPayments,
    },
  });
}

// GET /psychologists/:id/consultations?status=scheduled
export async function listPsychologistConsultationsByStatus(
  req: Request,
  res: Response
) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psyId = String(req.params.id);
  const actor = (req as any).user;
  if (forbidIfNotOwnerOrAdmin(actor, psyId))
    return res.status(403).json({ error: { message: "Forbidden" } });

  const { status } = req.query as { status?: string };
  const where: any = { psychologist_id: psyId };
  if (status) where.status = status;

  const items = await prisma.consultations.findMany({
    where,
    orderBy: { scheduled_start_at: "asc" },
    include: { patient: true },
  });

  res.json({ items });
}

// GET /psychologists/:id/payments
export async function getPsychologistPaymentsSummary(
  req: Request,
  res: Response
) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psyId = String(req.params.id);
  const actor = (req as any).user;
  if (forbidIfNotOwnerOrAdmin(actor, psyId))
    return res.status(403).json({ error: { message: "Forbidden" } });

  const [paid, failed, pending] = await Promise.all([
    prisma.payments.aggregate({
      _sum: { amount: true },
      _count: true,
      where: { consultation: { psychologist_id: psyId }, status: "paid" },
    }),
    prisma.payments.aggregate({
      _count: true,
      where: { consultation: { psychologist_id: psyId }, status: "failed" },
    }),
    prisma.payments.aggregate({
      _count: true,
      where: { consultation: { psychologist_id: psyId }, status: "pending" },
    }),
  ]);

  res.json({
    payments: {
      paid_count: paid._count,
      paid_amount_sum: paid._sum.amount ?? 0,
      failed_count: failed._count,
      pending_count: pending._count,
    },
  });
}

// GET /psychologists/:id/intake-forms
export async function listPsychologistIntakeFormsDash(
  req: Request,
  res: Response
) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psyId = String(req.params.id);
  const actor = (req as any).user;
  if (forbidIfNotOwnerOrAdmin(actor, psyId))
    return res.status(403).json({ error: { message: "Forbidden" } });

  const items = await prisma.intake_forms.findMany({
    where: { psychologist_id: psyId },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      consultation_id: true,
      patient_id: true,
      created_at: true,
      symptoms_text: true,
      goals_text: true,
    },
  });

  res.json({ items });
}

// GET /psychologists/:id/ai-reports
export async function getPsychologistAiReports(req: Request, res: Response) {
  if (!req.params.id)
    return res
      .status(400)
      .json({ error: { message: "Psychologist ID is required" } });
  const psyId = String(req.params.id);
  const actor = (req as any).user;
  if (forbidIfNotOwnerOrAdmin(actor, psyId))
    return res.status(403).json({ error: { message: "Forbidden" } });

  // Insight sederhana: distribusi risk_level dari ai_intake_analysis + ringkasan terbaru dari ai_consultation_notes
  const analyses = await prisma.ai_intake_analysis.findMany({
    where: { intake_form: { psychologist_id: psyId } },
    orderBy: { created_at: "desc" },
  });

  // ✅ Perbaikan typing agar tidak complain "possibly undefined"
  type RiskLevel = "low" | "medium" | "high";
  const byLevel: Record<RiskLevel, number> = { low: 0, medium: 0, high: 0 };

  for (const a of analyses) {
    const key = (a.risk_level ?? "").toLowerCase();
    if (key === "low" || key === "medium" || key === "high") {
      byLevel[key as RiskLevel] += 1;
    }
  }

  const latestNotes = await prisma.ai_consultation_notes.findMany({
    where: { psychologist_id: psyId },
    orderBy: { created_at: "desc" },
    take: 10,
    select: {
      consultation_id: true,
      notes_text: true,
      mitigation_recommendations: true,
      created_at: true,
    },
  });

  res.json({
    ai_reports: {
      risk_distribution: byLevel,
      latest_notes: latestNotes,
    },
  });
}
