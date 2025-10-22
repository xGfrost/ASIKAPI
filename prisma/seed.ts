/* eslint-disable no-console */
// prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** ---------------------------
 * Utils
 * --------------------------- */
const iso = (d: Date | string) => new Date(d);
const HOURS = (h: number) => h * 3600 * 1000;

async function clearDatabase() {
  console.log("🧹 Clearing all tables (FK-safe order)...");
  // Hapus entitas turunan lebih dulu agar tidak kena constraint
  await prisma.ai_consultation_notes.deleteMany({});
  await prisma.ai_intake_analysis.deleteMany({});
  await prisma.intake_forms.deleteMany({});
  await prisma.stream_channels.deleteMany({});
  await prisma.payments.deleteMany({});
  await prisma.reviews.deleteMany({});
  await prisma.consultations.deleteMany({});
  await prisma.availabilities.deleteMany({});
  await prisma.psychologist_specialties.deleteMany({});
  await prisma.specialties.deleteMany({});
  await prisma.psychologists.deleteMany({});
  await prisma.users.deleteMany({});
  console.log("✅ All tables cleared.");
}

async function upsertSpecialties(names: string[]) {
  const created = [];
  for (const name of names) {
    const s = await prisma.specialties.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    created.push(s);
  }
  return created;
}

async function createPatientUser(full_name: string, email: string) {
  const password = await bcrypt.hash("password123", 10);
  return prisma.users.create({
    data: {
      role: "patient",
      full_name,
      email,
      password,
      gender: "other",
      image:
        "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
    },
  });
}

async function createPsychologistUser(opts: {
  full_name: string;
  email: string;
  license_no: string;
  bio: string;
  price_chat: number;
  price_video: number;
  image?: string;
  specialties: string[]; // by name
}) {
  const password = await bcrypt.hash("password123", 10);

  // 1) Buat user (role psychologist)
  const user = await prisma.users.create({
    data: {
      role: "psychologist",
      full_name: opts.full_name,
      email: opts.email,
      password,
      gender: "other",
      image:
        opts.image ??
        "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
    },
  });

  // 2) Buat record psychologists dengan id = user.id (1-1)
  const psy = await prisma.psychologists.create({
    data: {
      id: user.id, // penting: sama dengan users.id
      license_no: opts.license_no,
      bio: opts.bio,
      price_chat: opts.price_chat,
      price_video: opts.price_video,
      rating_avg: 0,
      rating_count: 0,
    },
  });

  // 3) Assign specialties berdasarkan nama
  for (const name of opts.specialties) {
    const s = await prisma.specialties.findUnique({ where: { name } });
    if (s) {
      await prisma.psychologist_specialties.create({
        data: { psychologist_id: psy.id, specialty_id: s.id },
      });
    }
  }

  return { user, psy };
}

async function main() {
  console.log("🌱 Starting seed...");
  await clearDatabase();

  /** ---------------------------
   * Admin
   * --------------------------- */
  const admin = await prisma.users.create({
    data: {
      role: "admin",
      full_name: "Admin ASIK",
      email: "admin@asik.local",
      password: await bcrypt.hash("admin123", 10),
      gender: "other",
      image:
        "https://images.unsplash.com/photo-1588345921523-c2dcdb7f1dcd?w=800&dpr=2&q=80",
    },
  });

  /** ---------------------------
   * Specialties
   * --------------------------- */
  const specs = await upsertSpecialties([
    "Anxiety",
    "Depression",
    "Trauma",
    "Child & Adolescent",
    "Couples",
    "Career",
  ]);
  console.log(`✅ Specialties: ${specs.length}`);

  /** ---------------------------
   * Psychologists (3)
   * --------------------------- */
  const psy1 = await createPsychologistUser({
    full_name: "Dr. Sinta Pramudita, M.Psi, Psikolog",
    email: "sinta@asik.local",
    license_no: "PSI-001-2020",
    bio: "Fokus pada kecemasan & depresi. CBT & ACT.",
    price_chat: 150000,
    price_video: 250000,
    specialties: ["Anxiety", "Depression"],
  });

  const psy2 = await createPsychologistUser({
    full_name: "Harlan Nugraha, S.Psi, Psikolog",
    email: "harlan@asik.local",
    license_no: "PSI-002-2019",
    bio: "Trauma healing, EMDR, dan dukungan krisis.",
    price_chat: 170000,
    price_video: 270000,
    specialties: ["Trauma", "Career"],
  });

  const psy3 = await createPsychologistUser({
    full_name: "Nadia Putri, M.Psi, Psikolog",
    email: "nadia@asik.local",
    license_no: "PSI-003-2021",
    bio: "Perkembangan anak & remaja, parenting.",
    price_chat: 140000,
    price_video: 230000,
    specialties: ["Child & Adolescent", "Couples"],
  });

  /** ---------------------------
   * Availabilities
   * --------------------------- */
  await prisma.availabilities.createMany({
    data: [
      // psy1: Senin & Rabu 09:00–12:00 UTC
      {
        psychologist_id: psy1.psy.id,
        weekday: 1,
        start_time: iso("1970-01-01T09:00:00Z"),
        end_time: iso("1970-01-01T12:00:00Z"),
      },
      {
        psychologist_id: psy1.psy.id,
        weekday: 3,
        start_time: iso("1970-01-01T09:00:00Z"),
        end_time: iso("1970-01-01T12:00:00Z"),
      },
      // psy2: Selasa 13:00–17:00 UTC
      {
        psychologist_id: psy2.psy.id,
        weekday: 2,
        start_time: iso("1970-01-01T13:00:00Z"),
        end_time: iso("1970-01-01T17:00:00Z"),
      },
      // psy3: Kamis 10:00–14:00 UTC
      {
        psychologist_id: psy3.psy.id,
        weekday: 4,
        start_time: iso("1970-01-01T10:00:00Z"),
        end_time: iso("1970-01-01T14:00:00Z"),
      },
    ],
  });

  /** ---------------------------
   * Patients
   * --------------------------- */
  const pat1 = await createPatientUser("Budi Santoso", "budi@asik.local");
  const pat2 = await createPatientUser("Maya Kartika", "maya@asik.local");

  /** ---------------------------
   * Consultations
   * --------------------------- */
  const now = new Date();

  const cons1 = await prisma.consultations.create({
    data: {
      patient_id: pat1.id,
      psychologist_id: psy1.psy.id,
      channel: "video",
      status: "completed",
      scheduled_start_at: new Date(now.getTime() - 72 * HOURS(1)),
      scheduled_end_at: new Date(now.getTime() - 71 * HOURS(1)),
      price: psy1.psy.price_video,
      patient_notes: "Sering cemas saat kerja dan sulit tidur.",
    },
  });

  const cons2 = await prisma.consultations.create({
    data: {
      patient_id: pat2.id,
      psychologist_id: psy2.psy.id,
      channel: "chat",
      status: "scheduled",
      scheduled_start_at: new Date(now.getTime() + 24 * HOURS(1)),
      scheduled_end_at: new Date(now.getTime() + 25 * HOURS(1)),
      price: psy2.psy.price_chat,
      patient_notes: "Butuh konseling karier & transisi kerja.",
    },
  });

  /** ---------------------------
   * Payments
   * --------------------------- */
  await prisma.payments.createMany({
    data: [
      {
        consultation_id: cons1.id,
        amount: Number(psy1.psy.price_video ?? 250000),
        method: "transfer",
        status: "paid",
        paid_at: new Date(now.getTime() - 70 * HOURS(1)),
        external_id: "INV-0001",
      },
      {
        consultation_id: cons2.id,
        amount: Number(psy2.psy.price_chat ?? 170000),
        method: "qris",
        status: "pending",
        external_id: "INV-0002",
      },
    ],
  });

  /** ---------------------------
   * Stream Channel (untuk cons2)
   * --------------------------- */
  await prisma.stream_channels.create({
    data: {
      consultation_id: cons2.id,
      stream_channel_id: `asik-chat-${cons2.id}`,
      stream_type: "chat",
    },
  });

  /** ---------------------------
   * Intake Form + AI Intake Analysis (cons1)
   * --------------------------- */
  const intake1 = await prisma.intake_forms.create({
    data: {
      consultation_id: cons1.id,
      patient_id: pat1.id,
      psychologist_id: psy1.psy.id,
      symptoms_text: "Cemas, jantung berdebar, sulit tidur 3 minggu terakhir.",
      duration_text: "3 minggu",
      triggers_text: "Deadline kerja & konflik dengan atasan.",
      goals_text: "Mengelola kecemasan dan tidur lebih baik.",
      additional_info: "Tidak ada riwayat obat psikiatri.",
    },
  });

  await prisma.ai_intake_analysis.create({
    data: {
      intake_form_id: intake1.id,
      risk_level: "medium",
      risk_score: 5.5, // Prisma Decimal akan menerima number
      risk_flags_json: JSON.stringify({
        keywords: ["cemas", "sulit tidur", "deadline"],
      }),
      recommendations_text:
        "Pertimbangkan CBT untuk insomnia & teknik relaksasi. Jadwalkan follow-up 1 minggu.",
    },
  });

  /** ---------------------------
   * AI Consultation Notes (cons1)
   * --------------------------- */
  await prisma.ai_consultation_notes.create({
    data: {
      consultation_id: cons1.id,
      psychologist_id: psy1.psy.id,
      patient_id: pat1.id,
      notes_text:
        "Sesi fokus pada psychoeducation tentang kecemasan, breathing exercise, dan sleep hygiene.",
      diarization_json: JSON.stringify([
        { speaker: "patient", text: "Saya sulit tidur" },
      ]),
      risk_analysis_json: JSON.stringify({ level: "medium", score: 5.5 }),
      mitigation_recommendations:
        "Lanjutkan breathing 4-7-8, batasi kafein, buat jadwal tidur konsisten.",
    },
  });

  /** ---------------------------
   * Review (cons1)
   * --------------------------- */
  await prisma.reviews.create({
    data: {
      consultation_id: cons1.id,
      patient_id: pat1.id,
      psychologist_id: psy1.psy.id,
      rating: 5,
      comment:
        "Psikolog ramah & penjelasannya jelas. Latihan napas membantu.",
    },
  });

  // Update agregat rating psy1
  const agg = await prisma.reviews.aggregate({
    where: { psychologist_id: psy1.psy.id },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.psychologists.update({
    where: { id: psy1.psy.id },
    data: {
      rating_avg: agg._avg.rating ?? 0,
      rating_count: agg._count.rating,
    },
  });

  /** ---------------------------
   * Logs
   * --------------------------- */
  console.log("✅ Seed done.");
  console.log("Admin login:");
  console.log("  email: admin@asik.local");
  console.log("  pass : admin123");
  console.log("Psikolog login sample:");
  console.log("  sinta@asik.local / password123");
  console.log("  harlan@asik.local / password123");
  console.log("  nadia@asik.local / password123");
  console.log("Pasien login sample:");
  console.log("  budi@asik.local / password123");
  console.log("  maya@asik.local / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
