<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 21 Games / SOL GaMES (`21-Games-Website`) — Agent & Co-Editing Rules

## 1. Ownership & Deployment Architecture
- **Source Repository**: `gerardrickjardin/21-Games-Website` (`origin/main`)
- **Primary Live URL — `https://21games.ai`**: served by its own standalone Vercel project (`21-games-website` / `sol-games`) deploying directly from `gerardrickjardin/21-Games-Website` (`origin/main`) with `npm run build` (root `basePath` = `""`). Decoupled from `SOL-World` so commits to `SOL-World` can never overwrite or revert `21games.ai`.
- **Legacy Subpath Redirects (`https://www.solworld.ai/solgames/*`)**: `SOL-World/vercel.json` permanently redirects `/solgames` and `/solgames/:path*` (`308`) to `https://21games.ai` and `https://21games.ai/:path*`. `21-Games-Website/vercel.json` also permanently redirects `/solgames` and `/solgames/:path*` to `/` and `/:path*` on `21games.ai`.
- **Co-Developers**:
  - **Lucas Huff** (`@LucasSOLT`, `233151608+LucasSOLT@users.noreply.github.com`)
  - **Gerard Rick Jardin** (`@gerardrickjardin`, `gerard@soltheory.com`, `gerardrickjardin@gmail.com`)

---

## 2. Mandatory Co-Editing & Build Sync Workflow
1. **Pre-Edit Pull**:
   ```bash
   git fetch origin && git pull --rebase origin main
   ```
2. **Source of Truth & `basePath` Configuration**:
   - `next.config.ts` uses `output: 'export'` and `basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? ''`.
   - `npm run build` → root build (`basePath` = `""`), which is the primary production build deployed to `https://21games.ai`.
   - `npm run build:solworld` / `npm run deploy:solworld` → legacy `/solgames` basePath build if ever needed for local subpath testing or static archive sync.
   - Always edit Next.js source files here in `21-Games-Website/src/`.
3. **Commit & Push**:
   - Verify `npm run lint` and `npm run build` pass cleanly, then commit and push to `21-Games-Website` (`origin/main`). Vercel automatically builds and deploys `https://21games.ai`.

---

## 3. Master Game Design Bible (`GAME_DESIGN_BIBLE.md`)
- **Mandatory Reference**: Always read [`GAME_DESIGN_BIBLE.md`](./GAME_DESIGN_BIBLE.md) (and keep it synced with any brain artifact `game_design_bible.md`) before planning, designing, or implementing any game in SOL GaMES (`21 → 1`).
- Whenever Lucas provides new game rules, answers to design questions, scoring formulas, or UI changes, update `GAME_DESIGN_BIBLE.md` first so no game specification is ever lost across sessions.

