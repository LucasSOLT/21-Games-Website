/**
 * Game #2 — Move Two (`move-2`) Pure 3D Trimetric Projection & Rigid-Body Edge-Hinge Physics
 *
 * Implements the classic Bloxorz diagonal 3D camera and 90° bottom-edge hinge kinematics:
 * - World coordinates `(c, r, z)`:
 *   • `+c` (columns, Right): `e_c = (0.92, -0.24)`
 *   • `+r` (rows, Down):     `e_r = (0.35, +0.68)`
 *   • `+z` (height, Up):     `e_z = (0.00, -0.92)`
 * - Exact orthographic camera view ray `V = (-0.35, +0.92, +0.7713)` used for:
 *   • Back-face culling (`dot(normal, V) > 0`)
 *   • Directional NYT Gold lighting (`#FEF08A` sunlit top ↔ `#F7DA21` mid ↔ `#CA8A04` shadow)
 *   • Painter's Algorithm back-to-front occlusion (`depth = -0.35*c + 0.92*r + 0.7713*z`)
 */

import {
  getBridgeForCell,
  getSwitchAtCell,
  type MoveTwoBlockState,
  type MoveTwoCoord,
  type MoveTwoDirection,
  type MoveTwoPosture,
  type MoveTwoStage,
  type MoveTwoTileType,
} from "@/lib/generators/move-two-generator";

export interface Point3D {
  c: number;
  r: number;
  z: number;
}

export interface Point2D {
  x: number;
  y: number;
}

export const TRIMETRIC_EC = { x: 0.92, y: -0.24 } as const;
export const TRIMETRIC_ER = { x: 0.35, y: 0.68 } as const;
export const TRIMETRIC_EZ = { x: 0, y: -0.92 } as const;

/** Camera ray pointing from world origin toward viewer (`project(V) = (0,0)`). */
export const CAMERA_VIEW_RAY: Point3D = {
  c: -0.35,
  r: 0.92,
  z: 0.7713043478,
};

/** Normalized warm upper-left directional sun vector in `(c, r, z)` space. */
const SUN_LIGHT_DIR: Point3D = (() => {
  const raw = { c: -0.38, r: -0.18, z: 0.907 };
  const len = Math.hypot(raw.c, raw.r, raw.z);
  return { c: raw.c / len, r: raw.r / len, z: raw.z / len };
})();

export const TILE_SLAB_THICKNESS = 0.28;

export interface BoardViewportFit {
  scale: number;
  originX: number;
  originY: number;
  width: number;
  height: number;
}

/** Projects an unscaled `(c, r, z)` point into unit trimetric 2D coordinates. */
export function projectUnitTrimetric(pt: Point3D): Point2D {
  return {
    x: pt.c * TRIMETRIC_EC.x + pt.r * TRIMETRIC_ER.x + pt.z * TRIMETRIC_EZ.x,
    y: pt.c * TRIMETRIC_EC.y + pt.r * TRIMETRIC_ER.y + pt.z * TRIMETRIC_EZ.y,
  };
}

/** Projects a 3D world point `(c, r, z)` into pixel coordinates using `fit`. */
export function projectPoint3D(pt: Point3D, fit: BoardViewportFit): Point2D {
  const u = projectUnitTrimetric(pt);
  return {
    x: fit.originX + u.x * fit.scale,
    y: fit.originY + u.y * fit.scale,
  };
}

/** Computes exact Painter's Algorithm depth key (smaller = farther back, larger = closer to viewer). */
export function computeCameraDepth(pt: Point3D): number {
  return (
    pt.c * CAMERA_VIEW_RAY.c +
    pt.r * CAMERA_VIEW_RAY.r +
    pt.z * CAMERA_VIEW_RAY.z
  );
}

/**
 * Computes responsive scale and pixel origin so any `6×6`, `8×8`, or `10×10` floating island
 * (plus standing `z = +2.1` towers and `z = -1.2` cliff drops) fits comfortably inside `(width, height)`.
 */
export function computeBoardViewportFit(
  size: number,
  width: number,
  height: number,
  paddingPx: number = 18
): BoardViewportFit {
  const safeW = Math.max(120, width);
  const safeH = Math.max(120, height);

  const sampleBounds: Point3D[] = [
    { c: 0, r: 0, z: 2.25 },
    { c: size, r: 0, z: 2.25 },
    { c: size, r: size, z: 2.25 },
    { c: 0, r: size, z: 2.25 },
    { c: 0, r: 0, z: -0.95 },
    { c: size, r: 0, z: -0.95 },
    { c: size, r: size, z: -0.95 },
    { c: 0, r: size, z: -0.95 },
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const p of sampleBounds) {
    const u = projectUnitTrimetric(p);
    if (u.x < minX) minX = u.x;
    if (u.x > maxX) maxX = u.x;
    if (u.y < minY) minY = u.y;
    if (u.y > maxY) maxY = u.y;
  }

  const unitSpanX = Math.max(1, maxX - minX);
  const unitSpanY = Math.max(1, maxY - minY);

  const availW = Math.max(60, safeW - paddingPx * 2);
  const availH = Math.max(60, safeH - paddingPx * 2);
  const scale = Math.min(availW / unitSpanX, availH / unitSpanY);

  const centerUnitX = (minX + maxX) * 0.5;
  const centerUnitY = (minY + maxY) * 0.5;

  return {
    scale,
    originX: safeW * 0.5 - centerUnitX * scale,
    originY: safeH * 0.5 - centerUnitY * scale,
    width: safeW,
    height: safeH,
  };
}

export interface ProjectedFacePolygon {
  vertices2D: [Point2D, Point2D, Point2D, Point2D];
  fillHex: string;
  strokeHex: string;
  depth: number;
}

export interface CuboidRenderUnit {
  depth: number;
  faces: ProjectedFacePolygon[];
}

export type CuboidAnimationPose =
  | {
      mode: "idle";
      state: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
      dropZ?: number;
    }
  | {
      mode: "rolling";
      from: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
      dir: MoveTwoDirection;
      /** `0..1` eased roll progress (`0° -> 90°`). */
      progress: number;
    }
  | {
      mode: "falling_edge";
      from: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
      dir: MoveTwoDirection;
      /** `0..1` overall cliff-fall progress (`0..0.48` rolls 90°, `0.48..1` tips past 90° + plunges). */
      progress: number;
      overhangDir: MoveTwoDirection;
    }
  | {
      mode: "breaking_fragile";
      from: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
      dir: MoveTwoDirection;
      /** `0..1` overall progress (`0..0.45` rolls upright onto fragile tile, `0.45..1` shatters & plunges). */
      progress: number;
      landed: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
    }
  | {
      mode: "dropping_goal";
      from: Pick<MoveTwoBlockState, "posture" | "r" | "c">;
      dir: MoveTwoDirection;
      /** `0..1` overall progress (`0..0.45` rolls upright over hole, `0.45..1` plunges straight down shaft). */
      progress: number;
      goal: MoveTwoCoord;
    };

interface BoxBounds3D {
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  z0: number;
  z1: number;
}

/** Splits a `1×1×2` block state into its two attached `1×1×1` unit cubes in 3D world space. */
export function getTwoUnitCubesForState(
  state: Pick<MoveTwoBlockState, "posture" | "r" | "c">,
  zOffset: number = 0
): [BoxBounds3D, BoxBounds3D] {
  const { posture, r, c } = state;
  if (posture === "UPRIGHT") {
    return [
      { c0: c, c1: c + 1, r0: r, r1: r + 1, z0: zOffset, z1: zOffset + 1 },
      { c0: c, c1: c + 1, r0: r, r1: r + 1, z0: zOffset + 1, z1: zOffset + 2 },
    ];
  }
  if (posture === "FLAT_H") {
    return [
      { c0: c, c1: c + 1, r0: r, r1: r + 1, z0: zOffset, z1: zOffset + 1 },
      { c0: c + 1, c1: c + 2, r0: r, r1: r + 1, z0: zOffset, z1: zOffset + 1 },
    ];
  }
  // FLAT_V
  return [
    { c0: c, c1: c + 1, r0: r, r1: r + 1, z0: zOffset, z1: zOffset + 1 },
    { c0: c, c1: c + 1, r0: r + 1, r1: r + 2, z0: zOffset, z1: zOffset + 1 },
  ];
}

function getOuterEnvelopeForState(
  state: Pick<MoveTwoBlockState, "posture" | "r" | "c">
): BoxBounds3D {
  const { posture, r, c } = state;
  if (posture === "UPRIGHT") {
    return { c0: c, c1: c + 1, r0: r, r1: r + 1, z0: 0, z1: 2 };
  }
  if (posture === "FLAT_H") {
    return { c0: c, c1: c + 2, r0: r, r1: r + 1, z0: 0, z1: 1 };
  }
  return { c0: c, c1: c + 1, r0: r, r1: r + 2, z0: 0, z1: 1 };
}

/** Rotates a 3D point around the bottom contact hinge edge of `envelope` in `dir` by `theta` radians. */
export function rotatePointAroundHinge(
  pt: Point3D,
  envelope: BoxBounds3D,
  dir: MoveTwoDirection,
  theta: number
): Point3D {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);

  switch (dir) {
    case "right": {
      const dc = pt.c - envelope.c1;
      const dz = pt.z - envelope.z0;
      return {
        c: envelope.c1 + dc * cos + dz * sin,
        r: pt.r,
        z: envelope.z0 - dc * sin + dz * cos,
      };
    }
    case "left": {
      const dc = pt.c - envelope.c0;
      const dz = pt.z - envelope.z0;
      return {
        c: envelope.c0 + dc * cos - dz * sin,
        r: pt.r,
        z: envelope.z0 + dc * sin + dz * cos,
      };
    }
    case "down": {
      const dr = pt.r - envelope.r1;
      const dz = pt.z - envelope.z0;
      return {
        c: pt.c,
        r: envelope.r1 + dr * cos + dz * sin,
        z: envelope.z0 - dr * sin + dz * cos,
      };
    }
    case "up": {
      const dr = pt.r - envelope.r0;
      const dz = pt.z - envelope.z0;
      return {
        c: pt.c,
        r: envelope.r0 + dr * cos - dz * sin,
        z: envelope.z0 + dr * sin + dz * cos,
      };
    }
  }
}

function shadeGoldByNormal(normal: Point3D): string {
  const dot =
    normal.c * SUN_LIGHT_DIR.c +
    normal.r * SUN_LIGHT_DIR.r +
    normal.z * SUN_LIGHT_DIR.z;
  // Map [-1, +1] -> warm NYT Gold ramp (#A16207 shadow -> #EAB308 mid -> #F7DA21 bright -> #FEF08A sunlit top)
  const t = Math.max(0, Math.min(1, (dot + 0.55) / 1.5));
  if (t > 0.84) return "#FEF08A";
  if (t > 0.66) return "#FDE047";
  if (t > 0.46) return "#F7DA21";
  if (t > 0.28) return "#EAB308";
  return "#CA8A04";
}

function cross3D(a: Point3D, b: Point3D): Point3D {
  return {
    c: a.r * b.z - a.z * b.r,
    r: a.z * b.c - a.c * b.z,
    z: a.c * b.r - a.r * b.c,
  };
}

function buildRotatedUnitCube(
  box: BoxBounds3D,
  transform: (pt: Point3D) => Point3D,
  fit: BoardViewportFit
): CuboidRenderUnit {
  const { c0, c1, r0, r1, z0, z1 } = box;

  // All 6 faces with outward-pointing (P1 - P0) x (P3 - P0) 3D winding
  const rawQuads: Array<[Point3D, Point3D, Point3D, Point3D]> = [
    // +z Top
    [
      { c: c0, r: r0, z: z1 },
      { c: c1, r: r0, z: z1 },
      { c: c1, r: r1, z: z1 },
      { c: c0, r: r1, z: z1 },
    ],
    // -z Bottom
    [
      { c: c0, r: r1, z: z0 },
      { c: c1, r: r1, z: z0 },
      { c: c1, r: r0, z: z0 },
      { c: c0, r: r0, z: z0 },
    ],
    // +r Front-Right
    [
      { c: c0, r: r1, z: z0 },
      { c: c0, r: r1, z: z1 },
      { c: c1, r: r1, z: z1 },
      { c: c1, r: r1, z: z0 },
    ],
    // -r Back-Left
    [
      { c: c1, r: r0, z: z0 },
      { c: c1, r: r0, z: z1 },
      { c: c0, r: r0, z: z1 },
      { c: c0, r: r0, z: z0 },
    ],
    // -c Front-Left
    [
      { c: c0, r: r0, z: z0 },
      { c: c0, r: r0, z: z1 },
      { c: c0, r: r1, z: z1 },
      { c: c0, r: r1, z: z0 },
    ],
    // +c Back-Right
    [
      { c: c1, r: r1, z: z0 },
      { c: c1, r: r1, z: z1 },
      { c: c1, r: r0, z: z1 },
      { c: c1, r: r0, z: z0 },
    ],
  ];

  const centerWorld = transform({
    c: (c0 + c1) * 0.5,
    r: (r0 + r1) * 0.5,
    z: (z0 + z1) * 0.5,
  });

  const visibleFaces: ProjectedFacePolygon[] = [];

  for (const quad of rawQuads) {
    const w0 = transform(quad[0]);
    const w1 = transform(quad[1]);
    const w2 = transform(quad[2]);
    const w3 = transform(quad[3]);

    const e1 = { c: w1.c - w0.c, r: w1.r - w0.r, z: w1.z - w0.z };
    const e2 = { c: w3.c - w0.c, r: w3.r - w0.r, z: w3.z - w0.z };
    const nRaw = cross3D(e1, e2);
    const nLen = Math.hypot(nRaw.c, nRaw.r, nRaw.z) || 1;
    const normal = { c: nRaw.c / nLen, r: nRaw.r / nLen, z: nRaw.z / nLen };

    const facing =
      normal.c * CAMERA_VIEW_RAY.c +
      normal.r * CAMERA_VIEW_RAY.r +
      normal.z * CAMERA_VIEW_RAY.z;
    if (facing <= 1e-4) {
      continue;
    }

    const faceCenter: Point3D = {
      c: (w0.c + w1.c + w2.c + w3.c) * 0.25,
      r: (w0.r + w1.r + w2.r + w3.r) * 0.25,
      z: (w0.z + w1.z + w2.z + w3.z) * 0.25,
    };

    visibleFaces.push({
      vertices2D: [
        projectPoint3D(w0, fit),
        projectPoint3D(w1, fit),
        projectPoint3D(w2, fit),
        projectPoint3D(w3, fit),
      ],
      fillHex: shadeGoldByNormal(normal),
      strokeHex: "#171717",
      depth: computeCameraDepth(faceCenter),
    });
  }

  visibleFaces.sort((a, b) => a.depth - b.depth);

  return {
    depth: computeCameraDepth(centerWorld),
    faces: visibleFaces,
  };
}

function easeOutCubic(t: number): number {
  const u = 1 - Math.max(0, Math.min(1, t));
  return 1 - u * u * u;
}

function easeInQuad(t: number): number {
  const u = Math.max(0, Math.min(1, t));
  return u * u;
}

/**
 * Computes the depth-sorted pair of 3D projected unit cubes representing the `1×1×2` cuboid
 * for any stationary, rolling, cliff-tumbling, fragile-shattering, or goal-dropping pose.
 */
export function computeHingedCuboidUnits(
  pose: CuboidAnimationPose,
  fit: BoardViewportFit
): CuboidRenderUnit[] {
  if (pose.mode === "idle") {
    const dz = pose.dropZ ?? 0;
    const [u0, u1] = getTwoUnitCubesForState(pose.state, dz);
    const units = [
      buildRotatedUnitCube(u0, (p) => p, fit),
      buildRotatedUnitCube(u1, (p) => p, fit),
    ];
    return units.sort((a, b) => a.depth - b.depth);
  }

  if (pose.mode === "rolling") {
    const theta = easeOutCubic(pose.progress) * (Math.PI * 0.5);
    const env = getOuterEnvelopeForState(pose.from);
    const [u0, u1] = getTwoUnitCubesForState(pose.from);
    const xf = (p: Point3D) => rotatePointAroundHinge(p, env, pose.dir, theta);
    return [
      buildRotatedUnitCube(u0, xf, fit),
      buildRotatedUnitCube(u1, xf, fit),
    ].sort((a, b) => a.depth - b.depth);
  }

  if (pose.mode === "falling_edge") {
    const env = getOuterEnvelopeForState(pose.from);
    const [u0, u1] = getTwoUnitCubesForState(pose.from);

    if (pose.progress <= 0.45) {
      const localT = pose.progress / 0.45;
      const theta = easeOutCubic(localT) * (Math.PI * 0.5);
      const xf = (p: Point3D) => rotatePointAroundHinge(p, env, pose.dir, theta);
      return [
        buildRotatedUnitCube(u0, xf, fit),
        buildRotatedUnitCube(u1, xf, fit),
      ].sort((a, b) => a.depth - b.depth);
    }

    // Phase 2: tip past 90° over the cliff edge + accelerate downward with gravity
    const fallT = (pose.progress - 0.45) / 0.55;
    const extraTilt = easeInQuad(fallT) * (Math.PI * 0.42);
    const dropZ = -easeInQuad(fallT) * 3.1;
    const drift = easeInQuad(fallT) * 0.35;
    const driftC =
      pose.overhangDir === "right" ? drift : pose.overhangDir === "left" ? -drift : 0;
    const driftR =
      pose.overhangDir === "down" ? drift : pose.overhangDir === "up" ? -drift : 0;

    const xf = (p: Point3D) => {
      const rolled = rotatePointAroundHinge(
        p,
        env,
        pose.dir,
        Math.PI * 0.5 + extraTilt
      );
      return {
        c: rolled.c + driftC,
        r: rolled.r + driftR,
        z: rolled.z + dropZ,
      };
    };

    return [
      buildRotatedUnitCube(u0, xf, fit),
      buildRotatedUnitCube(u1, xf, fit),
    ].sort((a, b) => a.depth - b.depth);
  }

  if (pose.mode === "breaking_fragile") {
    if (pose.progress <= 0.44) {
      const localT = pose.progress / 0.44;
      const theta = easeOutCubic(localT) * (Math.PI * 0.5);
      const env = getOuterEnvelopeForState(pose.from);
      const [u0, u1] = getTwoUnitCubesForState(pose.from);
      const xf = (p: Point3D) => rotatePointAroundHinge(p, env, pose.dir, theta);
      return [
        buildRotatedUnitCube(u0, xf, fit),
        buildRotatedUnitCube(u1, xf, fit),
      ].sort((a, b) => a.depth - b.depth);
    }

    const fallT = (pose.progress - 0.44) / 0.56;
    const dropZ = -easeInQuad(fallT) * 3.2;
    const [u0, u1] = getTwoUnitCubesForState(pose.landed, dropZ);
    return [
      buildRotatedUnitCube(u0, (p) => p, fit),
      buildRotatedUnitCube(u1, (p) => p, fit),
    ].sort((a, b) => a.depth - b.depth);
  }

  // mode === "dropping_goal"
  if (pose.progress <= 0.46) {
    const localT = pose.progress / 0.46;
    const theta = easeOutCubic(localT) * (Math.PI * 0.5);
    const env = getOuterEnvelopeForState(pose.from);
    const [u0, u1] = getTwoUnitCubesForState(pose.from);
    const xf = (p: Point3D) => rotatePointAroundHinge(p, env, pose.dir, theta);
    return [
      buildRotatedUnitCube(u0, xf, fit),
      buildRotatedUnitCube(u1, xf, fit),
    ].sort((a, b) => a.depth - b.depth);
  }

  const shaftT = (pose.progress - 0.46) / 0.54;
  const dropZ = -easeInQuad(shaftT) * 2.55;
  const uprightGoalState: Pick<MoveTwoBlockState, "posture" | "r" | "c"> = {
    posture: "UPRIGHT" as MoveTwoPosture,
    r: pose.goal.r,
    c: pose.goal.c,
  };
  const [u0, u1] = getTwoUnitCubesForState(uprightGoalState, dropZ);
  return [
    buildRotatedUnitCube(u0, (p) => p, fit),
    buildRotatedUnitCube(u1, (p) => p, fit),
  ].sort((a, b) => a.depth - b.depth);
}

export type SceneDrawItem =
  | {
      kind: "tile";
      r: number;
      c: number;
      tileType: MoveTwoTileType;
      isStart: boolean;
      isGoal: boolean;
      bridgeOpen: boolean;
      bridgeId: string | null;
      switchKind: "soft" | "heavy" | null;
      brokenProgress: number; // >0 when fragile tile is actively shattering
      depth: number;
    }
  | {
      kind: "cuboid_unit";
      unit: CuboidRenderUnit;
      depth: number;
    };

/**
 * Builds the complete Painter's Algorithm back-to-front draw list combining all non-void
 * floating 3D tiles and the two hinged `1×1×1` cuboid units.
 */
export function buildDepthSortedRenderList(
  stage: Pick<
    MoveTwoStage,
    "size" | "grid" | "start" | "goal" | "bridges" | "switches"
  >,
  bridgeMask: number,
  cuboidUnits: CuboidRenderUnit[],
  brokenFragileCell?: { r: number; c: number; progress: number } | null
): SceneDrawItem[] {
  const items: SceneDrawItem[] = [];

  for (let r = 0; r < stage.size; r++) {
    for (let c = 0; c < stage.size; c++) {
      const tileType = stage.grid[r]![c]!;
      if (tileType === "void") continue;

      const bridgeLookup =
        tileType === "bridge" ? getBridgeForCell(stage, r, c) : null;
      const bridgeOpen = bridgeLookup
        ? (bridgeMask & (1 << bridgeLookup.index)) !== 0
        : false;
      const sw = getSwitchAtCell(stage, r, c);
      const isBroken =
        brokenFragileCell &&
        brokenFragileCell.r === r &&
        brokenFragileCell.c === c
          ? brokenFragileCell.progress
          : 0;

      const tileCenter: Point3D = {
        c: c + 0.5,
        r: r + 0.5,
        z: -TILE_SLAB_THICKNESS * 0.5,
      };

      items.push({
        kind: "tile",
        r,
        c,
        tileType,
        isStart: stage.start.r === r && stage.start.c === c,
        isGoal: stage.goal.r === r && stage.goal.c === c,
        bridgeOpen,
        bridgeId: bridgeLookup?.bridge.id ?? null,
        switchKind: sw?.kind ?? null,
        brokenProgress: isBroken,
        depth: computeCameraDepth(tileCenter),
      });
    }
  }

  for (const unit of cuboidUnits) {
    items.push({
      kind: "cuboid_unit",
      unit,
      depth: unit.depth,
    });
  }

  items.sort((a, b) => a.depth - b.depth);
  return items;
}

/** Converts a 2D touch/pointer delta into the natural 3D trimetric grid direction. */
export function resolveTrimetricSwipeDirection(
  dx: number,
  dy: number
): MoveTwoDirection | null {
  if (Math.hypot(dx, dy) < 22) return null;
  // Inverse of trimetric matrix [[0.92, 0.35], [-0.24, 0.68]] (det = 0.7096)
  const dc = (0.68 * dx - 0.35 * dy) / 0.7096;
  const dr = (0.24 * dx + 0.92 * dy) / 0.7096;
  if (Math.abs(dc) >= Math.abs(dr)) {
    return dc > 0 ? "right" : "left";
  }
  return dr > 0 ? "down" : "up";
}
