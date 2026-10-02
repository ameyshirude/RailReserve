const { Pool } = require("pg");
const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Prevent unhandled exceptions when an idle client encounters an error
// (e.g. database restart, network interruption)
pool.on("error", (err) => {
  console.error("[pg pool] Unexpected error on idle client:", err.message);
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Export pool alongside prisma so the server can drain it on shutdown
prisma.$pool = pool;

module.exports = prisma;
