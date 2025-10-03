import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";
import { createPaymentSchema, paymentWebhookSchema } from "../validators/payment.schema.js";

// POST /payments
export async function createPayment(req: Request, res: Response) {
  const body = createPaymentSchema.parse(req.body);

  // (opsional) Validasi kepemilikan consultation oleh user
  const actor = (req as any).user;
  const c = await prisma.consultations.findUnique({ where: { id: body.consultation_id } });
  if (!c) return res.status(404).json({ error: { message: "Consultation not found" } });
  if (!(actor.role === "admin" || actor.id === c.patient_id || actor.id === c.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  const payment = await prisma.payments.create({
    data: {
      consultation_id: body.consultation_id,
      amount: body.amount,
      method: body.method,
      status: "pending"
    }
  });

  res.status(201).json({ payment });
}

// GET /payments
export async function listPayments(req: Request, res: Response) {
  const actor = (req as any).user;
  const { status, consultation_id } = req.query as { status?: string; consultation_id?: string };

  const where: any = {};
  if (status) where.status = status;
  if (consultation_id) where.consultation_id = BigInt(consultation_id);

  // Jika bukan admin, filter hanya yang terkait dengan user
  if (actor.role !== "admin") {
    where.consultation = {
      OR: [{ patient_id: actor.id }, { psychologist_id: actor.id }]
    };
  }

  const items = await prisma.payments.findMany({
    where,
    orderBy: { created_at: "desc" }
  });

  res.json({ items });
}

// GET /payments/:id
export async function getPaymentById(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const actor = (req as any).user;

  const p = await prisma.payments.findUnique({
    where: { id },
    include: { consultation: true }
  });
  if (!p) return res.status(404).json({ error: { message: "Payment not found" } });

  if (!(actor.role === "admin" || actor.id === p.consultation.patient_id || actor.id === p.consultation.psychologist_id)) {
    return res.status(403).json({ error: { message: "Forbidden" } });
  }

  res.json({ payment: p });
}

// PUT /payments/:id  (admin)
export async function updatePaymentStatus(req: Request, res: Response) {
    if (!req.params.id) return res.status(400).json({ error: { message: "Psychologist ID is required" } });
  const id = BigInt(req.params.id);
  const { status, paid_at } = req.body as { status: "pending" | "paid" | "failed"; paid_at?: string };

  const updated = await prisma.payments.update({
    where: { id },
    data: {
      status,
      paid_at: paid_at ? new Date(paid_at) : null,
      updated_at: new Date()
    }
  });

  // Jika paid, pastikan konsultasi minimal scheduled
  if (status === "paid") {
    await prisma.consultations.update({
      where: { id: updated.consultation_id },
      data: { status: "scheduled", updated_at: new Date() }
    });
  }

  res.json({ payment: updated });
}

// POST /payments/webhook
export async function paymentWebhook(req: Request, res: Response) {
  const body = paymentWebhookSchema.parse(req.body);
  const paidAt = body.paid_at ? new Date(body.paid_at) : null;

  const p = await prisma.payments.update({
    where: { external_id: body.external_id },
    data: { status: body.status, paid_at: paidAt, updated_at: new Date() }
  });

  if (body.status === "paid") {
    await prisma.consultations.update({
      where: { id: p.consultation_id },
      data: { status: "scheduled", updated_at: new Date() }
    });
  }

  res.json({ ok: true });
}
