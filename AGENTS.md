<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 21 Games / SOL GaMES (`21-Games-Website`) — Agent & Co-Editing Rules

## 1. Ownership & Deployment Architecture
- **Source Repository**: `gerardrickjardin/21-Games-Website` (`origin/main`)
- **Deploy target A — `https://21games.ai`**: its own Vercel project built from this repo with plain `npm run build` (site at the domain root, `basePath` = `""`).
- **Deploy target B — Static Host Repository**: `gerardrickjardin/SOL-World` (`solgames/`, `dist/solgames/`, and `public/solgames/` subdirectories → `https://sol-world.vercel.app/solgames/`), built with `basePath` = `/solgames`.
- **Co-Developers**:
  - **Lucas Huff** (`@LucasSOLT`, `233151608+LucasSOLT@users.noreply.github.com`)
  - **Gerard Rick Jardin** (`@gerardrickjardin`, `gerard@soltheory.com`, `gerardrickjardin@gmail.com`)

---

## 2. Mandatory Co-Editing & Build Sync Workflow
1. **Pre-Edit Pull (Both Repos)**:
   ```bash
   git fetch origin && git pull --rebase origin main
   cd ../SOL-World && git fetch origin && git pull --rebase origin main
   ```
2. **Source of Truth & `basePath` Configuration**:
   - `next.config.ts` uses `output: 'export'` and `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? ''`.
   - `npm run build` → root build (what Vercel runs for 21games.ai). `npm run build:solworld` → `/solgames` build.
   - Never hardcode `/solgames/...` in `src/`. For files in `public/` referenced from plain `<img>`/`<a>` tags use `assetPath('/file.png')` from `src/lib/asset-path.ts`; `next/link` hrefs get the basePath automatically.
   - Always edit Next.js source files here in `21-Games-Website/src/` (never edit compiled files inside `../SOL-World/solgames/` directly).
3. **Syncing Static Export to `SOL-World/solgames/`**:
   - Run:
     ```bash
     npm run deploy:solworld
     ```
     This runs `npm run build:solworld` (outputting to `out/` with `basePath: '/solgames'`) and syncs `out/` cleanly into `../SOL-World/solgames/`, `../SOL-World/dist/solgames/`, and `../SOL-World/public/solgames/`.
   - If you added any new `.png` files in `public/`, remember that `SOL-World/.gitignore` ignores `*.png` by default—run `git add -f solgames/<new-file>.png dist/solgames/<new-file>.png public/solgames/<new-file>.png` inside `../SOL-World`.
4. **Commit & Push Both Repositories**:
   - Commit and push your source changes to `21-Games-Website` (`origin/main`) AND commit/push the updated static export in `../SOL-World` (`origin/main`) so the source repo and live `/solgames/` deployment never drift apart.

