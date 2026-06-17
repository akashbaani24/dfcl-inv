import type { NextConfig } from "next";

// At build time, ensure Prisma has a valid DATABASE_URL.
// On Vercel, DATABASE_URL might be set to a postgres:// URL (from a previous setup),
// but our schema.prisma uses provider='sqlite'. This causes Prisma validation to fail.
// Solution: set PRISMA_DATABASE_URL to a dummy file: URL at build time.
// The actual connection uses TURSO_DATABASE_URL via @prisma/adapter-libsql.
if (!process.env.PRISMA_DATABASE_URL) {
  process.env.PRISMA_DATABASE_URL = process.env.DATABASE_URL?.startsWith('file:')
    ? process.env.DATABASE_URL
    : 'file:db.sqlite'
}

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["bcryptjs", "@prisma/client"],
  allowedDevOrigins: [
    "*.space-z.ai",
    "*.chatglm.cn",
  ],
  // Pass env vars to runtime
  env: {
    PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL,
  },
};

export default nextConfig;
