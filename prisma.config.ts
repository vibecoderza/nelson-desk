import { defineConfig } from "prisma/config";

// DATABASE_URL is the owner connection (migrations and the Desk). The Portal connects with DATABASE_URL_PORTAL,
// a role that is a member of desk_portal. Neither value is ever written in this repo.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "postgresql://unset:unset@localhost:5432/unset" },
});
