require("dotenv").config();
const bcrypt = require("bcryptjs");
const prisma = require("./src/prismaClient");

const SALT_ROUNDS = 12;

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;
  const phone = process.env.ADMIN_PHONE;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const admin = await prisma.user.upsert({
    where: { username },
    update: { passwordHash, email, phone, role: "ADMIN" },
    create: { username, passwordHash, email, phone, role: "ADMIN" },
  });

  console.log(`Admin account seeded successfully with username: "${admin.username}"`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
