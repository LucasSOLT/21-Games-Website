"use client";

import React from "react";
import {
  describeEchoTile,
  echoDotPositions,
  echoShapeSvgGeometry,
  type EchoTile,
} from "@/data/puzzles/eightfold-echo";
import { ImageWithFallback } from "@/components/image-with-fallback";
import { cn } from "@/lib/utils";

interface EchoTileSvgProps {
  tile: EchoTile;
  /** Unique suffix so SVG `<clipPath id>` never collides across tiles on the page. */
  clipKey: string;
  className?: string;
}

function PureEchoSvg({
  tile,
  clipKey,
  className,
}: EchoTileSvgProps) {
  const outer = echoShapeSvgGeometry(tile.shape, 1);
  const inner = echoShapeSvgGeometry(tile.shape, 0.54);
  const dots = echoDotPositions(tile.marks);
  const stroke = "#111111";
  const fillInk = "#18181b";
  const clipId = `echo-clip-${clipKey}`;

  const needsClip =
    tile.fill === "left" ||
    tile.fill === "right" ||
    tile.fill === "top" ||
    tile.fill === "bottom" ||
    tile.fill === "quadrant";

  const renderShape = (
    geom: ReturnType<typeof echoShapeSvgGeometry>,
    props: React.SVGProps< SVGElement >
  ) => {
    if (geom.tag === "circle") {
      return <circle {...geom.attrs} {...(props as React.SVGProps<SVGCircleElement>)} />;
    }
    if (geom.tag === "rect") {
      return <rect {...geom.attrs} {...(props as React.SVGProps<SVGRectElement>)} />;
    }
    return <polygon {...geom.attrs} {...(props as React.SVGProps<SVGPolygonElement>)} />;
  };

  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("w-full h-full select-none pointer-events-none", className)}
      aria-hidden="true"
    >
      {needsClip && (
        <defs>
          <clipPath id={clipId}>{renderShape(outer, {})}</clipPath>
        </defs>
      )}

      {renderShape(outer, {
        fill: tile.fill === "solid" ? fillInk : "#ffffff",
        stroke,
        strokeWidth: 4.2,
        strokeLinejoin: "round",
      })}

      {needsClip && (
        <g clipPath={`url(#${clipId})`}>
          {tile.fill === "left" && <rect x={0} y={0} width={50} height={100} fill={fillInk} />}
          {tile.fill === "right" && <rect x={50} y={0} width={50} height={100} fill={fillInk} />}
          {tile.fill === "top" && <rect x={0} y={0} width={100} height={44} fill={fillInk} />}
          {tile.fill === "bottom" && <rect x={0} y={44} width={100} height={56} fill={fillInk} />}
          {tile.fill === "quadrant" && <rect x={0} y={0} width={50} height={44} fill={fillInk} />}
        </g>
      )}

      {needsClip &&
        renderShape(outer, {
          fill: "none",
          stroke,
          strokeWidth: 4.2,
          strokeLinejoin: "round",
        })}

      {tile.fill === "ring" &&
        renderShape(inner, {
          fill: "none",
          stroke,
          strokeWidth: 3.4,
          strokeLinejoin: "round",
        })}

      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={3.6} fill={stroke} />
      ))}
    </svg>
  );
}

/**
 * Renders a parametric inline SVG shape tile, or an optional custom SVG URL wrapped in
 * `<ImageWithFallback>` whose fallback is the deterministic inline SVG shape.
 */
export function EchoTileSvg({ tile, clipKey, className }: EchoTileSvgProps) {
  if (tile.customSvgUrl) {
    return (
      <ImageWithFallback
        src={tile.customSvgUrl}
        alt={describeEchoTile(tile)}
        className={cn("w-full h-full object-contain select-none pointer-events-none", className)}
        fallbackIcon={<PureEchoSvg tile={tile} clipKey={clipKey} className={className} />}
      />
    );
  }
  return <PureEchoSvg tile={tile} clipKey={clipKey} className={className} />;
}
