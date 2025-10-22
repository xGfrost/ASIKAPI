import { prisma } from "../config/prisma.js";
import { createSpecialtySchema, assignSpecialtiesSchema, } from "../validators/speciality.schema.js";
/* =========================
 *  Helpers
 * ========================= */
const toId = (x) => String(x);
/* =========================
 *  Controllers
 * ========================= */
// GET /specialties
export async function listSpecialties(_req, res) {
    const items = await prisma.specialties.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, created_at: true },
    });
    return res.json({ items });
}
// POST /specialties  (ADMIN)
export async function adminCreateSpecialty(req, res) {
    const parsed = createSpecialtySchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(422)
            .json({ error: { message: "Validation failed", issues: parsed.error.issues } });
    }
    const { name } = parsed.data;
    const specialty = await prisma.specialties.create({
        data: { name },
        select: { id: true, name: true, created_at: true },
    });
    return res.status(201).json({ specialty });
}
/**
 * POST /psychologists/:id/specialties
 * Body: { specialty_ids: string[] | number[] }
 * - Replace semua spesialisasi milik psikolog tsb
 * - Hanya admin / owner (psychologist yg sama id-nya) yg boleh
 */
export async function assignPsychologistSpecialties(req, res) {
    const idParam = req.params.id;
    if (!idParam) {
        return res.status(400).json({ error: { message: "Psychologist ID is required" } });
    }
    const psychologistId = toId(idParam);
    // auth: admin atau owner
    const actor = req.user;
    if (!actor)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    if (actor.role !== "admin" &&
        !(actor.role === "psychologist" && actor.id === psychologistId)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const parsed = assignSpecialtiesSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(422)
            .json({ error: { message: "Validation failed", issues: parsed.error.issues } });
    }
    // pastikan psikolog ada
    const psy = await prisma.psychologists.findUnique({ where: { id: psychologistId } });
    if (!psy) {
        return res.status(404).json({ error: { message: "Psychologist not found" } });
    }
    // validasi bahwa semua specialty id ada
    const ids = parsed.data.specialty_ids.map(toId);
    const found = await prisma.specialties.findMany({
        where: { id: { in: ids } },
        select: { id: true },
    });
    const foundIds = new Set(found.map((s) => s.id));
    const missing = ids.filter((i) => !foundIds.has(i));
    if (missing.length > 0) {
        return res.status(400).json({
            error: { message: `Unknown specialty id(s): ${missing.join(", ")}` },
        });
    }
    // replace all specialties
    await prisma.$transaction(async (tx) => {
        await tx.psychologist_specialties.deleteMany({
            where: { psychologist_id: psychologistId },
        });
        if (ids.length > 0) {
            await tx.psychologist_specialties.createMany({
                data: ids.map((sid) => ({
                    psychologist_id: psychologistId,
                    specialty_id: sid,
                })),
                skipDuplicates: true,
            });
        }
    });
    const psychologist = await prisma.psychologists.findUnique({
        where: { id: psychologistId },
        include: { specialties: { include: { specialty: true } } },
    });
    return res.json({ psychologist });
}
/**
 * DELETE /psychologists/:id/specialties/:sid
 */
export async function removePsychologistSpecialty(req, res) {
    const idParam = req.params.id;
    const sidParam = req.params.sid;
    if (!idParam || !sidParam) {
        return res.status(400).json({
            error: { message: "Psychologist ID and Specialty ID are required" },
        });
    }
    const psychologistId = toId(idParam);
    const specialtyId = toId(sidParam);
    const actor = req.user;
    if (!actor)
        return res.status(401).json({ error: { message: "Unauthorized" } });
    if (actor.role !== "admin" &&
        !(actor.role === "psychologist" && actor.id === psychologistId)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
    }
    await prisma.psychologist_specialties.deleteMany({
        where: { psychologist_id: psychologistId, specialty_id: specialtyId },
    });
    return res.json({ ok: true });
}
