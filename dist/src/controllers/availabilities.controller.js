import { prisma } from "../config/prisma.js";
import { z } from "zod";
// ----- Validators (sesuaikan jika kamu sudah punya schema terpisah) -----
const availabilitySchema = z.object({
    weekday: z.coerce.number().int().min(0).max(6),
    start_time: z.string(), // "09:00" atau ISO string
    end_time: z.string(),
});
const updateAvailabilitySchema = z.object({
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    start_time: z.string().optional(),
    end_time: z.string().optional(),
});
// ----- Utils -----
function toBigInt(v) {
    if (typeof v === "bigint")
        return v;
    if (typeof v === "number")
        return BigInt(v);
    return BigInt(v);
}
function parseTimeToDate(input, label) {
    // dukung "HH:MM"
    const hhmm = /^(\d{1,2}):(\d{2})$/;
    const m = input.match(hhmm);
    if (m) {
        const h = Number(m[1]);
        const min = Number(m[2]);
        if (h < 0 || h > 23 || min < 0 || min > 59) {
            throw new Error(`Invalid ${label}, expected HH:MM`);
        }
        // gunakan UTC 1970-01-01 agar tanggal diabaikan
        return new Date(Date.UTC(1970, 0, 1, h, min, 0, 0));
    }
    // fallback: ISO/date string
    const d = new Date(input);
    if (isNaN(d.getTime())) {
        throw new Error(`Invalid ${label}, expected HH:MM or ISO datetime`);
    }
    return d;
}
function isOverlap(aStart, aEnd, bStart, bEnd) {
    // overlap jika tidak (aEnd <= bStart || aStart >= bEnd)
    return !(aEnd <= bStart || aStart >= bEnd);
}
function actorIsAdminOrOwner(actor, psyId) {
    if (!actor)
        return false;
    if (actor.role === "admin")
        return true;
    try {
        // pastikan tipe sama2 BigInt
        const actorId = String(actor.id);
        return actor.role === "psychologist" && actorId === psyId;
    }
    catch {
        return false;
    }
}
// ================== Controllers ==================
// POST /psychologists/:id/availabilities
export async function createAvailabilityForPsy(req, res) {
    try {
        if (!req.params.id)
            return res
                .status(400)
                .json({ error: { message: "Psychologist ID is required" } });
        const psyId = String(req.params.id);
        const actor = req.user;
        if (!actorIsAdminOrOwner(actor, psyId)) {
            return res.status(403).json({ error: { message: "Forbidden" } });
        }
        const parsed = availabilitySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({
                error: { message: "Validation failed", issues: parsed.error.issues },
            });
        }
        const { weekday, start_time, end_time } = parsed.data;
        const start = parseTimeToDate(start_time, "start_time");
        const end = parseTimeToDate(end_time, "end_time");
        if (end <= start)
            return res
                .status(400)
                .json({ error: { message: "end_time must be after start_time" } });
        // Cek overlap
        const sameDay = await prisma.availabilities.findMany({
            where: { psychologist_id: psyId, weekday },
            select: { id: true, start_time: true, end_time: true },
        });
        const hasOverlap = sameDay.some((a) => isOverlap(start, end, a.start_time, a.end_time));
        if (hasOverlap) {
            return res.status(409).json({
                error: { message: "Availability overlaps with existing slot" },
            });
        }
        const av = await prisma.availabilities.create({
            data: {
                psychologist_id: psyId,
                weekday,
                start_time: start,
                end_time: end,
            },
        });
        res.status(201).json({ availability: av });
    }
    catch (err) {
        const msg = err?.message || "Internal server error";
        if (/Can't reach database server|ECONN|ENOTFOUND/i.test(msg)) {
            return res
                .status(503)
                .json({ error: { message: "Database unavailable" } });
        }
        return res.status(500).json({ error: { message: msg } });
    }
}
// PUT /availabilities/:id
export async function updateAvailability(req, res) {
    try {
        if (!req.params.id)
            return res
                .status(400)
                .json({ error: { message: "Availability ID is required" } });
        const id = String(req.params.id);
        const av = await prisma.availabilities.findUnique({ where: { id } });
        if (!av)
            return res
                .status(404)
                .json({ error: { message: "Availability not found" } });
        const actor = req.user;
        if (!actorIsAdminOrOwner(actor, av.psychologist_id)) {
            return res.status(403).json({ error: { message: "Forbidden" } });
        }
        const parsed = updateAvailabilitySchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(422).json({
                error: { message: "Validation failed", issues: parsed.error.issues },
            });
        }
        const { weekday, start_time, end_time } = parsed.data;
        if (weekday === undefined && !start_time && !end_time) {
            return res
                .status(400)
                .json({ error: { message: "No fields to update" } });
        }
        const nextWeekday = weekday ?? av.weekday;
        const nextStart = start_time
            ? parseTimeToDate(start_time, "start_time")
            : av.start_time;
        const nextEnd = end_time
            ? parseTimeToDate(end_time, "end_time")
            : av.end_time;
        if (nextEnd <= nextStart) {
            return res
                .status(400)
                .json({ error: { message: "end_time must be after start_time" } });
        }
        // cek overlap (exclude dirinya sendiri)
        const sameDay = await prisma.availabilities.findMany({
            where: {
                psychologist_id: av.psychologist_id,
                weekday: nextWeekday,
                NOT: { id },
            },
            select: { id: true, start_time: true, end_time: true },
        });
        const hasOverlap = sameDay.some((a) => isOverlap(nextStart, nextEnd, a.start_time, a.end_time));
        if (hasOverlap) {
            return res.status(409).json({
                error: { message: "Availability overlaps with existing slot" },
            });
        }
        const updated = await prisma.availabilities.update({
            where: { id },
            data: { weekday: nextWeekday, start_time: nextStart, end_time: nextEnd },
        });
        res.json({ availability: updated });
    }
    catch (err) {
        const msg = err?.message || "Internal server error";
        if (/Can't reach database server|ECONN|ENOTFOUND/i.test(msg)) {
            return res
                .status(503)
                .json({ error: { message: "Database unavailable" } });
        }
        return res.status(500).json({ error: { message: msg } });
    }
}
// DELETE /availabilities/:id
export async function deleteAvailability(req, res) {
    try {
        if (!req.params.id)
            return res
                .status(400)
                .json({ error: { message: "Availability ID is required" } });
        const id = String(req.params.id);
        const av = await prisma.availabilities.findUnique({ where: { id } });
        if (!av)
            return res
                .status(404)
                .json({ error: { message: "Availability not found" } });
        const actor = req.user;
        if (!actorIsAdminOrOwner(actor, av.psychologist_id)) {
            return res.status(403).json({ error: { message: "Forbidden" } });
        }
        await prisma.availabilities.delete({ where: { id } });
        res.json({ ok: true });
    }
    catch (err) {
        const msg = err?.message || "Internal server error";
        if (/Can't reach database server|ECONN|ENOTFOUND/i.test(msg)) {
            return res
                .status(503)
                .json({ error: { message: "Database unavailable" } });
        }
        return res.status(500).json({ error: { message: msg } });
    }
}
// GET /psychologists/:id/availabilities (PUBLIC)
export async function listPsychologistAvailabilities(req, res) {
    try {
        if (!req.params.id)
            return res
                .status(400)
                .json({ error: { message: "Psychologist ID is required" } });
        const id = String(req.params.id);
        const items = await prisma.availabilities.findMany({
            where: { psychologist_id: id },
            orderBy: [{ weekday: "asc" }, { start_time: "asc" }],
        });
        res.json({ items });
    }
    catch (err) {
        const msg = err?.message || "Internal server error";
        if (/Can't reach database server|ECONN|ENOTFOUND/i.test(msg)) {
            return res
                .status(503)
                .json({ error: { message: "Database unavailable" } });
        }
        return res.status(500).json({ error: { message: msg } });
    }
}
