"use client";

import React, { useState, type ImgHTMLAttributes, type ReactNode } from "react";
import { assetPath } from "@/lib/asset-path";

export interface ImageWithFallbackProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallbackSvgTitle?: string;
  fallbackIcon?: ReactNode;
}

/**
 * Resilient image component for SOL GaMES (Requirement R3).
 *
 * 1. Automatically prefixes relative asset paths with basePath (via assetPath).
 * 2. Catches broken URLs or 404s via onError.
 * 3. Renders a high-fidelity inline SVG fallback matching SOL GaMES editorial styling,
 *    preventing ugly browser broken image icons.
 */
export function ImageWithFallback({
  src,
  alt = "",
  className = "",
  style,
  fallbackSvgTitle,
  fallbackIcon,
  onError,
  ...rest
}: ImageWithFallbackProps) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  // Reset error state synchronously during render when src changes
  if (prevSrc !== src) {
    setPrevSrc(src);
    setHasError(false);
  }

  // Determine whether to apply assetPath
  const resolveSrc = (rawSrc?: string | Blob): string | undefined => {
    if (!rawSrc) return undefined;
    if (typeof rawSrc !== "string") {
      return undefined;
    }
    if (
      rawSrc.startsWith("http://") ||
      rawSrc.startsWith("https://") ||
      rawSrc.startsWith("data:") ||
      rawSrc.startsWith("blob:") ||
      rawSrc.startsWith("//")
    ) {
      return rawSrc;
    }

    const basePath =
      process.env.NODE_ENV === "development"
        ? ""
        : (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

    // Avoid double prefixing if the path already starts with basePath
    if (basePath && rawSrc.startsWith(basePath)) {
      return rawSrc;
    }

    return assetPath(rawSrc);
  };

  const resolvedSrc = resolveSrc(src);

  if (hasError || !resolvedSrc) {
    if (fallbackIcon) {
      return (
        <div
          className={`flex items-center justify-center bg-neutral-100 text-neutral-400 ${className}`}
          style={style}
          role="img"
          aria-label={alt || fallbackSvgTitle || "Image fallback"}
        >
          {fallbackIcon}
        </div>
      );
    }

    const titleText = fallbackSvgTitle || alt || "Image unavailable";

    return (
      <svg
        className={`inline-block ${className}`}
        style={style}
        viewBox="0 0 320 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={titleText}
      >
        <title>{titleText}</title>
        {/* Editorial Background Card */}
        <rect
          width="320"
          height="200"
          rx="12"
          fill="#F7F6F3"
          stroke="#111111"
          strokeWidth="2"
        />
        {/* Subtle Decorative Grid Pattern */}
        <line
          x1="20"
          y1="50"
          x2="300"
          y2="50"
          stroke="#E5E4E0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <line
          x1="20"
          y1="150"
          x2="300"
          y2="150"
          stroke="#E5E4E0"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Center Frame & Camera Icon */}
        <g transform="translate(110, 50)">
          {/* Camera Frame */}
          <rect
            x="12"
            y="20"
            width="76"
            height="56"
            rx="8"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="2"
          />
          {/* Top Camera Flash Bump */}
          <path
            d="M36 20L41 12H59L64 20"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Camera Lens */}
          <circle
            cx="50"
            cy="48"
            r="16"
            fill="#F4F4F5"
            stroke="#111111"
            strokeWidth="2"
          />
          {/* Inner Lens Reflection */}
          <circle cx="45" cy="43" r="4" fill="#111111" />

          {/* SOL GaMES Golden Spark Accent */}
          <g transform="translate(62, 10)">
            <circle cx="10" cy="10" r="10" fill="#FFC107" stroke="#111111" strokeWidth="1.5" />
            <path
              d="M10 5V15M5 10H15"
              stroke="#111111"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* Brand Editorial Caption */}
        <text
          x="160"
          y="155"
          textAnchor="middle"
          fill="#111111"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="800"
          fontSize="12"
          letterSpacing="0.05em"
        >
          SOL GaMES
        </text>
        <text
          x="160"
          y="172"
          textAnchor="middle"
          fill="#71717A"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="500"
          fontSize="10"
        >
          {titleText.length > 32 ? `${titleText.slice(0, 30)}…` : titleText}
        </text>
      </svg>
    );
  }

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      onError={(e) => {
        setHasError(true);
        onError?.(e);
      }}
      {...rest}
    />
  );
}
