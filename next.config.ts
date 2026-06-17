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
};

export default nextConfig;
