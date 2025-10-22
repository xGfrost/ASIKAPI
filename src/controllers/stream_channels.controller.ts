// src/controllers/stream_channels.controller.ts
import { Request, Response } from "express";
import { prisma } from "../config/prisma.js";

function toBigInt(v: any): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "string" && v.length > 0) return String(v);
  return String(v);
}

// POST /consultations/:id/stream-channel
// System attaches/updates stream channel id untuk konsultasi (tanpa role check)
export async function attachStreamChannel(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res
        .status(400)
        .json({ error: { message: "Consultation ID is required" } });
    }
    const id = toBigInt(req.params.id);

    // pastikan konsultasi ada
    const exists = await prisma.consultations.findUnique({ where: { id } });
    if (!exists) {
      return res
        .status(404)
        .json({ error: { message: "Consultation not found" } });
    }

    const { stream_channel_id, stream_type } = req.body as {
      stream_channel_id?: string;
      stream_type?: string;
    };

    if (
      !stream_channel_id ||
      typeof stream_channel_id !== "string" ||
      !stream_channel_id.trim()
    ) {
      return res
        .status(400)
        .json({ error: { message: "stream_channel_id is required" } });
    }

    const payload = {
      stream_channel_id: stream_channel_id.trim(),
      stream_type: (stream_type ?? "").trim() || null,
    };

    // kalau sudah ada untuk consultation ini → update, else create
    const existing = await prisma.stream_channels.findUnique({
      where: { consultation_id: id },
    });
    const sc = existing
      ? await prisma.stream_channels.update({
          where: { consultation_id: id },
          data: payload,
        })
      : await prisma.stream_channels.create({
          data: { consultation_id: id, ...payload },
        });

    // 201 kalau create, 200 kalau update (opsional)
    return res.status(existing ? 200 : 201).json({ stream_channel: sc });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}

// GET /consultations/:id/stream-channel
// System (atau klien) ambil info stream channel tanpa role check
export async function getStreamChannel(req: Request, res: Response) {
  try {
    if (!req.params.id) {
      return res
        .status(400)
        .json({ error: { message: "Consultation ID is required" } });
    }
    const id = toBigInt(req.params.id);

    // langsung cari by consultation_id
    const sc = await prisma.stream_channels.findUnique({
      where: { consultation_id: id },
    });
    if (!sc) {
      return res
        .status(404)
        .json({ error: { message: "Stream channel not found" } });
    }
    return res.json({ stream_channel: sc });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: { message: err?.message || "Internal server error" } });
  }
}
