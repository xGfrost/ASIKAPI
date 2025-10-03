import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

// GET /notifications
export async function getNotifications(req: Request, res: Response) {
  const actor = (req as any).user;

  // Notifikasi sederhana hasil derivasi:
  // - Konsultasi akan dimulai < 48 jam
  // - Pembayaran pending
  const soon = new Date();
  soon.setHours(soon.getHours() + 48);

  const consultations = await prisma.consultations.findMany({
    where: actor.role === "admin"
      ? { scheduled_start_at: { lte: soon }, status: { in: ["scheduled","ongoing"] } }
      : actor.role === "psychologist"
        ? { psychologist_id: actor.id, scheduled_start_at: { lte: soon }, status: { in: ["scheduled","ongoing"] } }
        : { patient_id: actor.id, scheduled_start_at: { lte: soon }, status: { in: ["scheduled","ongoing"] } },
    orderBy: { scheduled_start_at: "asc" },
    take: 10
  });

  const paymentsPending = await prisma.payments.findMany({
    where: actor.role === "admin"
      ? { status: "pending" }
      : { status: "pending", consultation: { OR: [{ patient_id: actor.id }, { psychologist_id: actor.id }] } },
    orderBy: { created_at: "desc" },
    take: 10
  });

  const notifications = [
    ...consultations.map(c => ({
      type: "consultation_upcoming",
      consultation_id: c.id,
      at: c.scheduled_start_at,
      message: `Sesi akan dimulai pada ${c.scheduled_start_at.toISOString()}`
    })),
    ...paymentsPending.map(p => ({
      type: "payment_pending",
      payment_id: p.id,
      consultation_id: p.consultation_id,
      message: `Pembayaran masih pending untuk konsultasi #${p.consultation_id}`
    }))
  ];

  res.json({ items: notifications });
}

// POST /export/report (admin)
export async function exportReport(req: Request, res: Response) {
  const { from, to } = req.body ?? {};
  const fromDate = from ? new Date(from) : new Date("1970-01-01");
  const toDate = to ? new Date(to) : new Date();

  // simple aggregate laporan admin
  const [consultations, payments] = await Promise.all([
    prisma.consultations.findMany({
      where: { created_at: { gte: fromDate, lte: toDate } },
      orderBy: { created_at: "asc" }
    }),
    prisma.payments.findMany({
      where: { created_at: { gte: fromDate, lte: toDate } },
      orderBy: { created_at: "asc" }
    })
  ]);

  const paidSum = payments.filter(p => p.status === "paid").reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

  res.json({
    report: {
      range: { from: fromDate.toISOString(), to: toDate.toISOString() },
      consultations_count: consultations.length,
      payments_count: payments.length,
      payments_paid_amount_sum: paidSum,
      sample: {
        consultations: consultations.slice(0, 20),
        payments: payments.slice(0, 20)
      }
    }
  });
}
