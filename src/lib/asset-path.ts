// Prefix a /public asset path with the build-time basePath.
// next/link and static imports get basePath automatically, but plain <img src="...">
// strings do not, so use this for anything served from /public.
const BASE_PATH =
  process.env.NODE_ENV === "development"
    ? ""
    : (process.env.NEXT_PUBLIC_BASE_PATH ?? "");

export function assetPath(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
