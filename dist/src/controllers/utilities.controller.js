import { prisma } from "../config/prisma.js";
/* =========================
 * GET /notifications
 * ========================= */
export async function getNotifications(req, res) {
    const actor = req.user;
    // Notifikasi sederhana:
    // - Konsultasi akan dimulai < 48 jam
    // - Pembayaran pending
    const soon = new Date();
    soon.setHours(soon.getHours() + 48);
    // Prisma perlu array bertipe consultation_status[]
    const ACTIVE_STATUSES = ["scheduled", "ongoing"];
    // ---- build where consultations sesuai role ----
    const whereConsultations = {
        scheduled_start_at: { lte: soon },
        status: { in: ACTIVE_STATUSES },
    };
    if (actor?.role === "admin") {
        // tidak menambah filter id
    }
    else if (actor?.role === "psychologist") {
        whereConsultations.psychologist_id = actor.id;
    }
    else {
        // default: patient
        if (actor?.id)
            whereConsultations.patient_id = actor.id;
    }
    const consultations = await prisma.consultations.findMany({
        where: whereConsultations,
        orderBy: { scheduled_start_at: "asc" },
        take: 10,
    });
    // ---- payments pending sesuai role ----
    let wherePayments;
    if (actor?.role === "admin") {
        wherePayments = { status: "pending" };
    }
    else {
        wherePayments = {
            status: "pending",
            consultation: {
                OR: [{ patient_id: actor?.id }, { psychologist_id: actor?.id }],
            },
        };
    }
    const paymentsPending = await prisma.payments.findMany({
        where: wherePayments,
        orderBy: { created_at: "desc" },
        take: 10,
    });
    const notifications = [
        ...consultations.map((c) => ({
            type: "consultation_upcoming",
            consultation_id: c.id,
            at: c.scheduled_start_at,
            message: `Sesi akan dimulai pada ${c.scheduled_start_at.toISOString()}`,
        })),
        ...paymentsPending.map((p) => ({
            type: "payment_pending",
            payment_id: p.id,
            consultation_id: p.consultation_id,
            message: `Pembayaran masih pending untuk konsultasi #${p.consultation_id}`,
        })),
    ];
    return res.json({ items: notifications });
}
/* =========================
 * POST /export/report (admin)
 * body: { from?: string; to?: string }
 * ========================= */
export async function exportReport(req, res) {
    const { from, to } = (req.body ?? {});
    const fromDate = from ? new Date(from) : new Date("1970-01-01T00:00:00.000Z");
    const toDate = to ? new Date(to) : new Date();
    const [consultations, payments] = await Promise.all([
        prisma.consultations.findMany({
            where: { created_at: { gte: fromDate, lte: toDate } },
            orderBy: { created_at: "asc" },
        }),
        prisma.payments.findMany({
            where: { created_at: { gte: fromDate, lte: toDate } },
            orderBy: { created_at: "asc" },
        }),
    ]);
    const payments_paid_amount_sum = payments
        .filter((p) => p.status === "paid")
        .reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
    return res.json({
        report: {
            range: { from: fromDate.toISOString(), to: toDate.toISOString() },
            consultations_count: consultations.length,
            payments_count: payments.length,
            payments_paid_amount_sum,
            sample: {
                consultations: consultations.slice(0, 20),
                payments: payments.slice(0, 20),
            },
        },
    });
}
