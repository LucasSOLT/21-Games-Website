import type { NextConfig } from "next";

// Live URL: https://www.solworld.ai/solgames/ (also https://sol-world.vercel.app/solgames/).
// The static export is copied into the SOL-World repo and served there -> basePath "/solgames".
// `npm run deploy:solworld` sets NEXT_PUBLIC_BASE_PATH=/solgames; a plain
// `npm run build` builds for a domain root (basePath "") and is not the live site.
// In local development (`next dev`), always serve at root (`basePath: ""`) and rewrite
// `/solgames` and `/solgames/:path*` so both `http://localhost:9002` and
// `http://localhost:9002/solgames` work seamlessly without 404ing.
const isDev = process.env.NODE_ENV === "development";
const basePath = isDev ? "" : (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

const nextConfig: NextConfig = {
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/solgames",
              destination: "/",
            },
            {
              source: "/solgames/:path*",
              destination: "/:path*",
            },
          ];
        },
      }
    : {
        output: "export",
      }),
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
