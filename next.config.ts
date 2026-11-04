import type { NextConfig } from "next";

// The same static export is served from two places:
//   - https://21games.ai (own Vercel project, site at the domain root)  -> basePath ""
//   - https://sol-world.vercel.app/solgames/ (copied into SOL-World)    -> basePath "/solgames"
// `npm run deploy:solworld` sets NEXT_PUBLIC_BASE_PATH=/solgames; a plain
// `npm run build` (what Vercel runs) builds for the domain root.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
