import type { NextConfig } from "next";

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
  // Pass PRISMA_DATABASE_URL to runtime (it's needed by Prisma at query time
  // even when using a driver adapter — Prisma still validates the URL).
  // The build command in vercel.json sets this before prisma generate.
  env: {
    PRISMA_DATABASE_URL: process.env.PRISMA_DATABASE_URL || 'file:db.sqlite',
  },
};

export default nextConfig;
