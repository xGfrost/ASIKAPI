import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  // specialties contoh
  const names = ["Anxiety", "Depression", "Relationship", "Stress", "Child & Adolescent"];
  await prisma.specialties.createMany({
    data: names.map((name) => ({ name })),
    skipDuplicates: true
  });
  console.log("Seeded specialties");
}

main().finally(() => prisma.$disconnect());
