import type { NextConfig } from "next";

// Primary Live URL: https://21games.ai (standalone Vercel project deploying from
// `gerardrickjardin/21-Games-Website` with `npm run build` -> root `basePath: ""`).
// Legacy / SOL-World subpath build: `npm run deploy:solworld` sets NEXT_PUBLIC_BASE_PATH=/solgames.
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
