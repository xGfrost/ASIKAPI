import { prisma } from "../config/prisma.js";
import { createReviewSchema } from "../validators/review.schema.js";
/* =========================
 *  Controllers
 * ========================= */
// POST /consultations/:id/reviews
export async function createReviewForConsultation(req, res) {
    if (!req.params.id) {
        return res.status(400).json({ error: { message: "Psychologist ID is required" } });
    }
    const userId = req.user.id;
    const cid = String(req.params.id);
    const body = createReviewSchema.parse({
        consultation_id: cid,
        rating: req.body?.rating,
        comment: req.body?.comment,
    });
    const c = await prisma.consultations.findUnique({
        where: { id: body.consultation_id },
        select: { patient_id: true, psychologist_id: true, status: true },
    });
    if (!c) {
        return res.status(404).json({ error: { message: "Consultation not found" } });
    }
    if (c.patient_id !== userId && req.user.role !== "admin") {
        return res.status(403).json({ error: { message: "Forbidden" } });
    }
    if (c.status !== "completed") {
        return res.status(400).json({ error: { message: "Consultation not completed" } });
    }
    const review = await prisma.reviews.create({
        data: {
            consultation_id: body.consultation_id,
            patient_id: userId,
            psychologist_id: c.psychologist_id,
            rating: body.rating,
            comment: body.comment,
        },
        select: {
            id: true,
            consultation_id: true,
            patient_id: true,
            psychologist_id: true,
            rating: true,
            comment: true,
            created_at: true,
        },
    });
    // update agregat rating
    const agg = await prisma.reviews.aggregate({
        where: { psychologist_id: c.psychologist_id },
        _avg: { rating: true },
        _count: { rating: true },
    });
    await prisma.psychologists.update({
        where: { id: c.psychologist_id },
        data: {
            rating_avg: agg._avg.rating ?? 0,
            rating_count: agg._count.rating,
        },
    });
    return res.status(201).json({ review });
}
// GET /consultations/:id/reviews
export async function getConsultationReviews(req, res) {
    if (!req.params.id) {
        return res.status(400).json({ error: { message: "Psychologist ID is required" } });
    }
    const cid = String(req.params.id);
    const items = await prisma.reviews.findMany({
        where: { consultation_id: cid },
        orderBy: { created_at: "desc" },
        include: {
            patient: { select: { id: true, full_name: true } },
        },
    });
    return res.json({ items });
}
// GET /psychologists/:id/reviews
export async function getPsychologistReviews(req, res) {
    if (!req.params.id) {
        return res.status(400).json({ error: { message: "Psychologist ID is required" } });
    }
    const pid = String(req.params.id);
    const items = await prisma.reviews.findMany({
        where: { psychologist_id: pid },
        orderBy: { created_at: "desc" },
        include: {
            patient: { select: { id: true, full_name: true } },
            consultation: { select: { id: true, channel: true, scheduled_start_at: true } },
        },
    });
    return res.json({ items });
}
