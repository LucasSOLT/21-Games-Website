"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  TILE_SLAB_THICKNESS,
  buildDepthSortedRenderList,
  computeBoardViewportFit,
  computeHingedCuboidUnits,
  projectPoint3D,
  resolveTrimetricSwipeDirection,
  type BoardViewportFit,
  type CuboidAnimationPose,
  type Point2D,
} from "@/lib/move-two-renderer-3d";
export { resolveTrimetricSwipeDirection };
import type {
  MoveTwoDirection,
  MoveTwoStage,
} from "@/lib/generators/move-two-generator";
import { cn } from "@/lib/utils";

export interface MoveTwoBloxorzCanvasProps {
  stage: MoveTwoStage;
  bridgeMask: number;
  pose: CuboidAnimationPose;
  brokenFragileCell?: { r: number; c: number; progress: number } | null;
  onSwipeDirection?: (dir: MoveTwoDirection) => void;
  interactive?: boolean;
  className?: string;
  testId?: string;
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  pts: Point2D[],
  fillStyle: string,
  strokeStyle: string = "#171717",
  lineWidth: number = 1.6
): void {
  if (pts.length < 3) return;
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i]!.x, pts[i]!.y);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  if (lineWidth > 0) {
    ctx.lineJoin = "miter";
    ctx.miterLimit = 6;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawFloatingSlab(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number,
  zTop: number,
  thickness: number,
  colors: { top: string; left: string; right: string; stroke?: string }
): void {
  const zBot = zTop - thickness;
  const stroke = colors.stroke ?? "#171717";
  const lw = Math.max(1.2, Math.min(2.0, fit.scale * 0.042));

  // Top corners
  const t00 = projectPoint3D({ c, r, z: zTop }, fit);
  const t10 = projectPoint3D({ c: c + 1, r, z: zTop }, fit);
  const t11 = projectPoint3D({ c: c + 1, r: r + 1, z: zTop }, fit);
  const t01 = projectPoint3D({ c, r: r + 1, z: zTop }, fit);

  // Bottom corners for visible front-left (-c) and front-right (+r) bevels
  const b00 = projectPoint3D({ c, r, z: zBot }, fit);
  const b01 = projectPoint3D({ c, r: r + 1, z: zBot }, fit);
  const b11 = projectPoint3D({ c: c + 1, r: r + 1, z: zBot }, fit);

  // Front-left bevel (-c)
  drawPolygon(ctx, [t00, t01, b01, b00], colors.left, stroke, lw);
  // Front-right bevel (+r)
  drawPolygon(ctx, [t01, t11, b11, b01], colors.right, stroke, lw);
  // Top face (+z)
  drawPolygon(ctx, [t00, t10, t11, t01], colors.top, stroke, lw);
}

function drawRetractedBridgeGhost(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number,
  bridgeId: string | null
): void {
  const t00 = projectPoint3D({ c: c + 0.08, r: r + 0.08, z: -0.02 }, fit);
  const t10 = projectPoint3D({ c: c + 0.92, r: r + 0.08, z: -0.02 }, fit);
  const t11 = projectPoint3D({ c: c + 0.92, r: r + 0.92, z: -0.02 }, fit);
  const t01 = projectPoint3D({ c: c + 0.08, r: r + 0.92, z: -0.02 }, fit);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(t00.x, t00.y);
  ctx.lineTo(t10.x, t10.y);
  ctx.lineTo(t11.x, t11.y);
  ctx.lineTo(t01.x, t01.y);
  ctx.closePath();
  ctx.fillStyle = "rgba(59, 130, 246, 0.07)";
  ctx.fill();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(37, 99, 235, 0.52)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);

  if (bridgeId && fit.scale >= 22) {
    const center = projectPoint3D({ c: c + 0.5, r: r + 0.5, z: -0.02 }, fit);
    ctx.fillStyle = "rgba(37, 99, 235, 0.65)";
    ctx.font = `700 ${Math.max(9, Math.round(fit.scale * 0.24))}px ui-monospace, monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(bridgeId, center.x, center.y);
  }
  ctx.restore();
}

function drawShatteringFragileTile(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number,
  progress: number
): void {
  const drop = progress * progress * 1.85;
  const spread = progress * 0.28;
  const quadrants = [
    { dc: 0, dr: 0, sc: -spread, sr: -spread },
    { dc: 0.5, dr: 0, sc: spread, sr: -spread },
    { dc: 0, dr: 0.5, sc: -spread, sr: spread },
    { dc: 0.5, dr: 0.5, sc: spread, sr: spread },
  ];

  ctx.save();
  ctx.globalAlpha = Math.max(0, 1 - progress * 0.88);
  for (const q of quadrants) {
    const c0 = c + q.dc + q.sc;
    const r0 = r + q.dr + q.sr;
    const zTop = -drop;
    const p0 = projectPoint3D({ c: c0, r: r0, z: zTop }, fit);
    const p1 = projectPoint3D({ c: c0 + 0.46, r: r0, z: zTop }, fit);
    const p2 = projectPoint3D({ c: c0 + 0.46, r: r0 + 0.46, z: zTop }, fit);
    const p3 = projectPoint3D({ c: c0, r: r0 + 0.46, z: zTop }, fit);
    drawPolygon(ctx, [p0, p1, p2, p3], "#EA580C", "#171717", 1.2);
  }
  ctx.restore();
}

function drawGoalShaftTile(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number
): void {
  // Outer emerald rim slab
  drawFloatingSlab(ctx, fit, c, r, 0, TILE_SLAB_THICKNESS, {
    top: "#2ECC71",
    left: "#22A85A",
    right: "#188344",
    stroke: "#171717",
  });

  // Recessed 1x1 interior square shaft (0.14 inset)
  const inset = 0.14;
  const c0 = c + inset;
  const c1 = c + 1 - inset;
  const r0 = r + inset;
  const r1 = r + 1 - inset;

  const rim00 = projectPoint3D({ c: c0, r: r0, z: 0.005 }, fit);
  const rim10 = projectPoint3D({ c: c1, r: r0, z: 0.005 }, fit);
  const rim11 = projectPoint3D({ c: c1, r: r1, z: 0.005 }, fit);
  const rim01 = projectPoint3D({ c: c0, r: r1, z: 0.005 }, fit);

  const deepZ = -0.52;
  const bot00 = projectPoint3D({ c: c0, r: r0, z: deepZ }, fit);
  const bot10 = projectPoint3D({ c: c1, r: r0, z: deepZ }, fit);
  const bot11 = projectPoint3D({ c: c1, r: r1, z: deepZ }, fit);

  ctx.save();
  // Clip to hole opening so deep shaft walls stay cleanly inside the rim
  ctx.beginPath();
  ctx.moveTo(rim00.x, rim00.y);
  ctx.lineTo(rim10.x, rim10.y);
  ctx.lineTo(rim11.x, rim11.y);
  ctx.lineTo(rim01.x, rim01.y);
  ctx.closePath();
  ctx.fillStyle = "#052E16";
  ctx.fill();
  ctx.clip();

  // Visible back-left (-r) and back-right (+c) interior shaft walls
  drawPolygon(ctx, [rim00, rim10, bot10, bot00], "#14532D", "#052E16", 1);
  drawPolygon(ctx, [rim10, rim11, bot11, bot10], "#0F3F22", "#052E16", 1);

  ctx.restore();

  // Crisp inner shaft border
  ctx.beginPath();
  ctx.moveTo(rim00.x, rim00.y);
  ctx.lineTo(rim10.x, rim10.y);
  ctx.lineTo(rim11.x, rim11.y);
  ctx.lineTo(rim01.x, rim01.y);
  ctx.closePath();
  ctx.strokeStyle = "#171717";
  ctx.lineWidth = Math.max(1.3, fit.scale * 0.036);
  ctx.stroke();
}

function drawSwitchInlay(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number,
  kind: "soft" | "heavy"
): void {
  // Raised metallic press plate
  const pad = 0.16;
  const zPlate = 0.055;
  const p00 = projectPoint3D({ c: c + pad, r: r + pad, z: zPlate }, fit);
  const p10 = projectPoint3D({ c: c + 1 - pad, r: r + pad, z: zPlate }, fit);
  const p11 = projectPoint3D(
    { c: c + 1 - pad, r: r + 1 - pad, z: zPlate },
    fit
  );
  const p01 = projectPoint3D({ c: c + pad, r: r + 1 - pad, z: zPlate }, fit);

  drawPolygon(
    ctx,
    [p00, p10, p11, p01],
    kind === "heavy" ? "#EDE9FE" : "#E0F2FE",
    "#171717",
    1.3
  );

  if (kind === "soft") {
    // ○ Soft Switch: projected circle on the zPlate plane
    ctx.beginPath();
    const steps = 20;
    const rad = 0.23;
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * Math.PI * 2;
      const pt = projectPoint3D(
        {
          c: c + 0.5 + Math.cos(ang) * rad,
          r: r + 0.5 + Math.sin(ang) * rad,
          z: zPlate + 0.01,
        },
        fit
      );
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();
    ctx.fillStyle = "#2563EB";
    ctx.fill();
    ctx.strokeStyle = "#171717";
    ctx.lineWidth = Math.max(1.5, fit.scale * 0.04);
    ctx.stroke();
  } else {
    // ✕ Heavy Switch: bold 3D projected X cross (upright-only trigger)
    const arm = 0.23;
    const a1 = projectPoint3D(
      { c: c + 0.5 - arm, r: r + 0.5 - arm, z: zPlate + 0.01 },
      fit
    );
    const a2 = projectPoint3D(
      { c: c + 0.5 + arm, r: r + 0.5 + arm, z: zPlate + 0.01 },
      fit
    );
    const b1 = projectPoint3D(
      { c: c + 0.5 + arm, r: r + 0.5 - arm, z: zPlate + 0.01 },
      fit
    );
    const b2 = projectPoint3D(
      { c: c + 0.5 - arm, r: r + 0.5 + arm, z: zPlate + 0.01 },
      fit
    );

    ctx.save();
    ctx.lineCap = "square";
    ctx.strokeStyle = "#6D28D9";
    ctx.lineWidth = Math.max(2.4, fit.scale * 0.075);
    ctx.beginPath();
    ctx.moveTo(a1.x, a1.y);
    ctx.lineTo(a2.x, a2.y);
    ctx.moveTo(b1.x, b1.y);
    ctx.lineTo(b2.x, b2.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawStartInlay(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number
): void {
  const pad = 0.22;
  const p00 = projectPoint3D({ c: c + pad, r: r + pad, z: 0.01 }, fit);
  const p10 = projectPoint3D({ c: c + 1 - pad, r: r + pad, z: 0.01 }, fit);
  const p11 = projectPoint3D({ c: c + 1 - pad, r: r + 1 - pad, z: 0.01 }, fit);
  const p01 = projectPoint3D({ c: c + pad, r: r + 1 - pad, z: 0.01 }, fit);

  drawPolygon(ctx, [p00, p10, p11, p01], "#FEF9C3", "#CA8A04", 1.2);
}

function drawBridgeSlats(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(29, 78, 216, 0.38)";
  ctx.lineWidth = 1.2;
  for (const frac of [0.32, 0.68]) {
    const a = projectPoint3D({ c: c + 0.14, r: r + frac, z: 0.01 }, fit);
    const b = projectPoint3D({ c: c + 0.86, r: r + frac, z: 0.01 }, fit);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFragileSeamInlay(
  ctx: CanvasRenderingContext2D,
  fit: BoardViewportFit,
  c: number,
  r: number
): void {
  const p0 = projectPoint3D({ c: c + 0.22, r: r + 0.3, z: 0.01 }, fit);
  const p1 = projectPoint3D({ c: c + 0.52, r: r + 0.52, z: 0.01 }, fit);
  const p2 = projectPoint3D({ c: c + 0.78, r: r + 0.44, z: 0.01 }, fit);
  const p3 = projectPoint3D({ c: c + 0.46, r: r + 0.76, z: 0.01 }, fit);

  ctx.save();
  ctx.strokeStyle = "rgba(124, 45, 18, 0.5)";
  ctx.lineWidth = Math.max(1.1, fit.scale * 0.028);
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(p0.x, p0.y);
  ctx.lineTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.stroke();
  ctx.restore();
}

export function MoveTwoBloxorzCanvas({
  stage,
  bridgeMask,
  pose,
  brokenFragileCell = null,
  onSwipeDirection,
  interactive = true,
  className,
  testId = "move-two-bloxorz-canvas",
}: MoveTwoBloxorzCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const [boxSize, setBoxSize] = useState<{ width: number; height: number }>({
    width: 480,
    height: 390,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) {
        setBoxSize((prev) =>
          Math.abs(prev.width - rect.width) < 1 &&
          Math.abs(prev.height - rect.height) < 1
            ? prev
            : { width: Math.round(rect.width), height: Math.round(rect.height) }
        );
      }
    };

    update();
    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(update);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr =
      typeof window !== "undefined"
        ? Math.min(2.5, Math.max(1, window.devicePixelRatio || 1))
        : 1;
    const targetW = Math.round(boxSize.width * dpr);
    const targetH = Math.round(boxSize.height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Editorial warm cream background + subtle radial vignette
    ctx.fillStyle = "#FAF9F5";
    ctx.fillRect(0, 0, boxSize.width, boxSize.height);

    const grad = ctx.createRadialGradient(
      boxSize.width * 0.5,
      boxSize.height * 0.48,
      boxSize.width * 0.08,
      boxSize.width * 0.5,
      boxSize.height * 0.52,
      boxSize.width * 0.68
    );
    grad.addColorStop(0, "rgba(255, 255, 255, 0.7)");
    grad.addColorStop(1, "rgba(229, 226, 217, 0.42)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, boxSize.width, boxSize.height);

    const fit = computeBoardViewportFit(
      stage.size,
      boxSize.width,
      boxSize.height,
      14
    );

    // 2. Soft floating island drop-shadow projected on z = -0.82 plane
    ctx.save();
    for (let r = 0; r < stage.size; r++) {
      for (let c = 0; c < stage.size; c++) {
        const tile = stage.grid[r]![c]!;
        if (tile === "void") continue;
        if (tile === "bridge") {
          const idx = stage.bridges.findIndex((b) =>
            b.cells.some((cell) => cell.r === r && cell.c === c)
          );
          if (idx < 0 || (bridgeMask & (1 << idx)) === 0) continue;
        }
        const s00 = projectPoint3D({ c, r, z: -0.78 }, fit);
        const s10 = projectPoint3D({ c: c + 1, r, z: -0.78 }, fit);
        const s11 = projectPoint3D({ c: c + 1, r: r + 1, z: -0.78 }, fit);
        const s01 = projectPoint3D({ c, r: r + 1, z: -0.78 }, fit);
        ctx.beginPath();
        ctx.moveTo(s00.x, s00.y);
        ctx.lineTo(s10.x, s10.y);
        ctx.lineTo(s11.x, s11.y);
        ctx.lineTo(s01.x, s01.y);
        ctx.closePath();
        ctx.fillStyle = "rgba(23, 23, 23, 0.065)";
        ctx.fill();
      }
    }
    ctx.restore();

    // 3. Painter's Algorithm back-to-front draw pass (tiles + 2 hinged cuboid units)
    const cuboidUnits = computeHingedCuboidUnits(pose, fit);
    const drawList = buildDepthSortedRenderList(
      stage,
      bridgeMask,
      cuboidUnits,
      brokenFragileCell
    );

    const cuboidStrokeWidth = Math.max(1.7, Math.min(2.6, fit.scale * 0.052));

    for (const item of drawList) {
      if (item.kind === "tile") {
        const {
          r,
          c,
          tileType,
          isStart,
          isGoal,
          bridgeOpen,
          bridgeId,
          switchKind,
          brokenProgress,
        } = item;

        if (isGoal) {
          drawGoalShaftTile(ctx, fit, c, r);
          continue;
        }

        if (tileType === "bridge") {
          if (bridgeOpen) {
            drawFloatingSlab(ctx, fit, c, r, 0, TILE_SLAB_THICKNESS * 0.82, {
              top: "#DBEAFE",
              left: "#93C5FD",
              right: "#60A5FA",
              stroke: "#171717",
            });
            drawBridgeSlats(ctx, fit, c, r);
          } else {
            drawRetractedBridgeGhost(ctx, fit, c, r, bridgeId);
          }
          continue;
        }

        if (tileType === "fragile") {
          if (brokenProgress > 0) {
            drawShatteringFragileTile(ctx, fit, c, r, brokenProgress);
          } else {
            drawFloatingSlab(ctx, fit, c, r, 0, TILE_SLAB_THICKNESS, {
              top: "#FB923C",
              left: "#EA580C",
              right: "#C2410C",
              stroke: "#171717",
            });
            drawFragileSeamInlay(ctx, fit, c, r);
          }
          continue;
        }

        // Standard floating stone slab ("floor" | "soft_switch" | "heavy_switch")
        drawFloatingSlab(ctx, fit, c, r, 0, TILE_SLAB_THICKNESS, {
          top: "#FFFFFF",
          left: "#E5E2D9",
          right: "#CFCBC0",
          stroke: "#171717",
        });

        if (isStart) {
          drawStartInlay(ctx, fit, c, r);
        }
        if (switchKind) {
          drawSwitchInlay(ctx, fit, c, r, switchKind);
        }
      } else {
        // 3D Hinged Cuboid Unit (Cube 0 or Cube 1)
        for (const face of item.unit.faces) {
          drawPolygon(
            ctx,
            face.vertices2D,
            face.fillHex,
            face.strokeHex,
            cuboidStrokeWidth
          );
        }
      }
    }

    ctx.restore();
  }, [stage, bridgeMask, pose, brokenFragileCell, boxSize]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      className={cn(
        "relative w-full aspect-[5/4] sm:aspect-[4/3] rounded-2xl border-2 border-black bg-[#FAF9F5] overflow-hidden select-none touch-none shadow-[0_4px_0_#171717]",
        className
      )}
      onPointerDown={(e) => {
        if (!interactive || !onSwipeDirection) return;
        pointerStartRef.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={(e) => {
        if (!interactive || !onSwipeDirection || !pointerStartRef.current) return;
        const dx = e.clientX - pointerStartRef.current.x;
        const dy = e.clientY - pointerStartRef.current.y;
        pointerStartRef.current = null;
        const dir = resolveTrimetricSwipeDirection(dx, dy);
        if (dir) {
          onSwipeDirection(dir);
        }
      }}
      onPointerCancel={() => {
        pointerStartRef.current = null;
      }}
    >
      <canvas
        ref={canvasRef}
        data-testid="move-two-3d-block"
        aria-label={`Move Two ${stage.size} by ${stage.size} floating 3D Bloxorz board`}
        className="block w-full h-full"
      />
    </div>
  );
}
