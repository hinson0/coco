import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@coco/shared", "@coco/ai"],
};

export default nextConfig;
