import { prisma } from "../config/prisma.js";
function scoreFromText(t) {
    if (!t)
        return 0;
    const s = t.toLowerCase();
    let score = 0;
    const high = [
        "bunuh diri",
        "suicide",
        "self-harm",
        "membunuh",
        "takut mati",
        "halusinasi",
    ];
    const med = [
        "depresi",
        "panic",
        "panic attack",
        "cemas",
        "anxiety",
        "insomnia",
    ];
    high.forEach((k) => {
        if (s.includes(k))
            score += 3;
    });
    med.forEach((k) => {
        if (s.includes(k))
            score += 2;
    });
    if (s.includes("sering") || s.includes("parah"))
        score += 1;
    return Math.min(score, 10);
}
function riskLevel(score) {
    if (score >= 7)
        return "high";
    if (score >= 4)
        return "medium";
    return "low";
}
// POST /consultations/:id/intake-form/ai-analysis
export async function runAiIntakeAnalysis(req, res) {
    if (!req.params.id)
        return res
            .status(400)
            .json({ error: { message: "Psychologist ID is required" } });
    const cid = String(req.params.id);
    const actor = req.user;
    const c = await prisma.consultations.findUnique({
        where: { id: cid },
        select: { patient_id: true, psychologist_id: true },
    });
    if (!c)
        return res
            .status(404)
            .json({ error: { message: "Consultation not found" } });
    if (actor.role !== "admin" &&
        !(actor.role === "psychologist" && actor.id === c.psychologist_id)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const form = await prisma.intake_forms.findUnique({
        where: { consultation_id: cid },
    });
    if (!form)
        return res
            .status(404)
            .json({ error: { message: "Intake form not found" } });
    const s = scoreFromText([
        form.symptoms_text,
        form.duration_text,
        form.triggers_text,
        form.additional_info,
    ].join(" "));
    const level = riskLevel(s);
    const flags = {
        keywords: { score: s, level },
        sources: [
            "symptoms_text",
            "duration_text",
            "triggers_text",
            "additional_info",
        ],
    };
    const recommendations = level === "high"
        ? "Segera lakukan asesmen risiko keselamatan, pertimbangkan crisis plan & rujukan darurat."
        : level === "medium"
            ? "Prioritaskan psychoeducation & coping plan; jadwalkan follow-up lebih sering."
            : "Lanjutkan rencana terapi sesuai tujuan pasien; monitor perubahan gejala.";
    const ai = await prisma.ai_intake_analysis.upsert({
        where: { intake_form_id: form.id },
        update: {
            risk_level: level,
            risk_score: s,
            risk_flags_json: JSON.stringify(flags),
            recommendations_text: recommendations,
            updated_at: new Date(),
        },
        create: {
            intake_form_id: form.id,
            risk_level: level,
            risk_score: s,
            risk_flags_json: JSON.stringify(flags),
            recommendations_text: recommendations,
        },
    });
    res.status(201).json({ ai_intake_analysis: ai });
}
// GET /consultations/:id/intake-form/ai-analysis
export async function getAiIntakeAnalysis(req, res) {
    if (!req.params.id)
        return res
            .status(400)
            .json({ error: { message: "Psychologist ID is required" } });
    const cid = String(req.params.id);
    const actor = req.user;
    const c = await prisma.consultations.findUnique({
        where: { id: cid },
        select: { patient_id: true, psychologist_id: true },
    });
    if (!c)
        return res
            .status(404)
            .json({ error: { message: "Consultation not found" } });
    if (!(actor.role === "admin" ||
        actor.id === c.patient_id ||
        actor.id === c.psychologist_id)) {
        return res.status(403).json({ error: { message: "Forbidden" } });
    }
    const form = await prisma.intake_forms.findUnique({
        where: { consultation_id: cid },
    });
    if (!form)
        return res
            .status(404)
            .json({ error: { message: "Intake form not found" } });
    const ai = await prisma.ai_intake_analysis.findUnique({
        where: { intake_form_id: form.id },
    });
    if (!ai)
        return res
            .status(404)
            .json({ error: { message: "AI analysis not found" } });
    res.json({ ai_intake_analysis: ai });
}
