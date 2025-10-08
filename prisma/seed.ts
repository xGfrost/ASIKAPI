/* eslint-disable no-console */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertSpecialties(names: string[]) {
  const result = [];
  for (const name of names) {
    const s = await prisma.specialties.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    result.push(s);
  }
  return result;
}

async function createPsychologistUser(opts: {
  full_name: string;
  email: string;
  license_no: string;
  bio: string;
  price_chat: number;
  price_video: number;
  specialties: string[]; // by name
}) {
  const password = await bcrypt.hash("password123", 10);

  // user
  const user = await prisma.users.create({
    data: {
      role: "psychologist",
      full_name: opts.full_name,
      email: opts.email,
      password,
      gender: "other",
    },
  });

  // psychologist profile (PK = users.id)
  const psy = await prisma.psychologists.create({
    data: {
      id: user.id,
      license_no: opts.license_no,
      bio: opts.bio,
      price_chat: opts.price_chat,
      price_video: opts.price_video,
      rating_avg: 0,
      rating_count: 0,
    },
  });

  // map specialties by name
  for (const name of opts.specialties) {
    const spec = await prisma.specialties.findUnique({ where: { name } });
    if (spec) {
      await prisma.psychologist_specialties.create({
        data: { psychologist_id: psy.id, specialty_id: spec.id },
      });
    }
  }

  return { user, psy };
}

async function createPatientUser(full_name: string, email: string) {
  const password = await bcrypt.hash("password123", 10);
  const u = await prisma.users.create({
    data: {
      role: "patient",
      full_name,
      email,
      password,
      gender: "other",
    },
  });
  return u;
}

async function main() {
  console.log("🌱 Seeding...");

  // --- Admin
  const admin = await prisma.users.upsert({
    where: { email: "admin@asik.local" },
    update: {},
    create: {
      role: "admin",
      full_name: "Admin ASIK",
      email: "admin@asik.local",
      password: await bcrypt.hash("admin123", 10),
      gender: "other",
    },
  });

  // --- Specialties
  const specs = await upsertSpecialties([
    "Anxiety",
    "Depression",
    "Trauma",
    "Child & Adolescent",
    "Couples",
    "Career",
  ]);
  console.log(`✅ specialties: ${specs.length}`);

  // --- Psychologists
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

  // --- Availabilities (pakai tanggal dummy untuk kolom TIME)
  await prisma.availabilities.createMany({
    data: [
      // Psy1: Senin & Rabu 09:00-12:00
      {
        psychologist_id: psy1.psy.id,
        weekday: 1,
        start_time: new Date("1970-01-01T09:00:00Z"),
        end_time: new Date("1970-01-01T12:00:00Z"),
      },
      {
        psychologist_id: psy1.psy.id,
        weekday: 3,
        start_time: new Date("1970-01-01T09:00:00Z"),
        end_time: new Date("1970-01-01T12:00:00Z"),
      },
      // Psy2: Selasa 13:00-17:00
      {
        psychologist_id: psy2.psy.id,
        weekday: 2,
        start_time: new Date("1970-01-01T13:00:00Z"),
        end_time: new Date("1970-01-01T17:00:00Z"),
      },
      // Psy3: Kamis 10:00-14:00
      {
        psychologist_id: psy3.psy.id,
        weekday: 4,
        start_time: new Date("1970-01-01T10:00:00Z"),
        end_time: new Date("1970-01-01T14:00:00Z"),
      },
    ],
    skipDuplicates: true,
  });

  // --- Patients
  const pat1 = await createPatientUser("Budi Santoso", "budi@asik.local");
  const pat2 = await createPatientUser("Maya Kartika", "maya@asik.local");

  // --- Consultations (1 completed + 1 scheduled)
  const now = new Date();
  const plusHours = (h: number) => new Date(now.getTime() + h * 3600 * 1000);

  // Completed consultation: pat1 with psy1
  const cons1 = await prisma.consultations.create({
    data: {
      patient_id: pat1.id,
      psychologist_id: psy1.psy.id,
      channel: "video",
      status: "completed",
      scheduled_start_at: new Date(now.getTime() - 72 * 3600 * 1000),
      scheduled_end_at: new Date(now.getTime() - 72 * 3600 * 1000 + 60 * 60 * 1000),
      price: psy1.psy.price_video,
      patient_notes: "Sering cemas saat kerja dan sulit tidur.",
    },
  });

  // Scheduled consultation: pat2 with psy2 (besok)
  const cons2 = await prisma.consultations.create({
    data: {
      patient_id: pat2.id,
      psychologist_id: psy2.psy.id,
      channel: "chat",
      status: "scheduled",
      scheduled_start_at: plusHours(24),
      scheduled_end_at: plusHours(25),
      price: psy2.psy.price_chat,
      patient_notes: "Butuh konseling karier & transisi kerja.",
    },
  });

  // --- Payments
  await prisma.payments.create({
    data: {
      consultation_id: cons1.id,
      amount: psy1.psy.price_video,
      method: "transfer",
      status: "paid",
      paid_at: new Date(now.getTime() - 70 * 3600 * 1000),
      external_id: "INV-0001",
    },
  });

  await prisma.payments.create({
    data: {
      consultation_id: cons2.id,
      amount: psy2.psy.price_chat,
      method: "qris",
      status: "pending",
      external_id: "INV-0002",
    },
  });

  // --- Stream channel contoh
  await prisma.stream_channels.create({
    data: {
      consultation_id: cons2.id,
      stream_channel_id: "asik-chat-" + String(cons2.id),
      stream_type: "chat",
    },
  });

  // --- Intake form & AI intake analysis (untuk cons1)
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
      risk_score: 5.5,
      risk_flags_json: JSON.stringify({
        keywords: ["cemas", "sulit tidur", "deadline"],
      }),
      recommendations_text:
        "Pertimbangkan CBT untuk insomnia & teknik relaksasi. Jadwalkan follow-up 1 minggu.",
    },
  });

  // --- AI consultation notes (untuk cons1)
  await prisma.ai_consultation_notes.create({
    data: {
      consultation_id: cons1.id,
      psychologist_id: psy1.psy.id,
      patient_id: pat1.id,
      notes_text:
        "Sesi fokus pada psychoeducation tentang kecemasan, breathing exercise, dan sleep hygiene.",
      diarization_json: JSON.stringify([{ speaker: "patient", text: "Saya sulit tidur" }]),
      risk_analysis_json: JSON.stringify({ level: "medium", score: 5.5 }),
      mitigation_recommendations:
        "Lanjutkan breathing 4-7-8, batasi kafein, buat jadwal tidur konsisten.",
    },
  });

  // --- Review (untuk cons1) + update rating otomatis (triggered by controller biasanya)
  const review = await prisma.reviews.create({
    data: {
      consultation_id: cons1.id,
      patient_id: pat1.id,
      psychologist_id: psy1.psy.id,
      rating: 5,
      comment: "Psikolog ramah & penjelasannya jelas. Latihan napas membantu.",
    },
  });

  // hitung ulang rating psy1
  const agg = await prisma.reviews.aggregate({
    where: { psychologist_id: psy1.psy.id },
    _avg: { rating: true },
    _count: { rating: true },
  });
  await prisma.psychologists.update({
    where: { id: psy1.psy.id },
    data: { rating_avg: agg._avg.rating ?? 0, rating_count: agg._count.rating },
  });

  console.log("✅ Done seeding.");
  console.log("Admin login:");
  console.log("  email: admin@asik.local");
  console.log("  pass : admin123");
  console.log("Psikolog login sample:");
  console.log("  sinta@asik.local / password123");
  console.log("Pasien login sample:");
  console.log("  budi@asik.local / password123");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
