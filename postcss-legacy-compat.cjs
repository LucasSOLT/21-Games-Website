/**
 * PostCSS Universal Cross-Browser & Legacy WebKit/Chromium Compatibility Plugin for 21 Games.
 *
 * Ensures 100% identical rendering across all browsers (Chrome Android/iOS/Desktop,
 * Safari < 15.4 / 15.4–16.3 / 17+, Samsung Internet, Firefox, Edge, and embedded WebViews):
 * 1. Unwraps @layer blocks (properties, theme, base, components, utilities) in exact cascade order.
 * 2. Resolves both #hex and oklch(...) Tailwind v4 theme variables inside color-mix(...) into
 *    universal rgba(...) / hsla(...) fallback declarations.
 * 3. Emits transform: translate/scale/rotate fallbacks before standalone CSS Transform Level 2 properties.
 * 4. Emits vh fallbacks before dvh / svh / lvh dynamic viewport units.
 * 5. Emits -webkit-backdrop-filter before unprefixed backdrop-filter.
 * 6. Emits top/right/bottom/left fallbacks before single-value inset shorthand.
 */

function hexToRgbTuple(hex) {
  const clean = String(hex).trim().replace(/^#/, "");
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  if (clean.length === 6) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return null;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

function linearToSrgb(c) {
  const clamped = Math.max(0, Math.min(1, c));
  return clamped <= 0.0031308
    ? 12.92 * clamped
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function oklchToRgbTuple(expr) {
  const m = String(expr)
    .trim()
    .match(/^oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)\s+([0-9.]+)(?:deg)?\s*\)$/i);
  if (!m) return null;
  let L = parseFloat(m[1]);
  if (m[2] === "%") L /= 100;
  const C = parseFloat(m[3]);
  const hRad = (parseFloat(m[4]) * Math.PI) / 180;
  if (!Number.isFinite(L) || !Number.isFinite(C) || !Number.isFinite(hRad)) {
    return null;
  }

  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const mLin = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const r = +4.0767416621 * l - 3.3077115913 * mLin + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * mLin - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * mLin + 1.707614701 * s;

  return [
    clampByte(linearToSrgb(r)),
    clampByte(linearToSrgb(g)),
    clampByte(linearToSrgb(bl)),
  ];
}

function resolveColorToRgbTuple(rawColor, rootVars) {
  const expr = String(rawColor).trim();
  if (expr.startsWith("#")) return hexToRgbTuple(expr);
  if (/^oklch\(/i.test(expr)) return oklchToRgbTuple(expr);
  if (expr.toLowerCase() === "black") return [0, 0, 0];
  if (expr.toLowerCase() === "white") return [255, 255, 255];

  const varMatch = expr.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
  if (varMatch) {
    const resolved = rootVars.get(varMatch[1]);
    if (resolved) {
      if (resolved.startsWith("#")) return hexToRgbTuple(resolved);
      if (/^oklch\(/i.test(resolved)) return oklchToRgbTuple(resolved);
    }
  }
  return null;
}

function buildColorMixFallback(value, rootVars) {
  if (!value.includes("color-mix(")) return null;

  let changed = false;
  const replaced = value.replace(
    /color-mix\(\s*in\s+[a-z0-9-]+\s*,\s*([^,]+?)\s+([0-9.]+)%\s*,\s*transparent\s*\)/gi,
    (full, rawColor, rawPct) => {
      const pct = Number(rawPct);
      if (!Number.isFinite(pct)) return full;
      const alpha = Math.max(0, Math.min(1, Number((pct / 100).toFixed(4))));
      const colorExpr = rawColor.trim();

      const hslVarMatch = colorExpr.match(
        /^hsl\(\s*(var\(--[a-zA-Z0-9_-]+\))\s*\)$/i
      );
      if (hslVarMatch) {
        changed = true;
        return `hsla(${hslVarMatch[1]}, ${alpha})`;
      }

      const rgb = resolveColorToRgbTuple(colorExpr, rootVars);
      if (rgb) {
        changed = true;
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
      }

      if (colorExpr.toLowerCase() === "currentcolor") {
        changed = true;
        return "currentColor";
      }

      return full;
    }
  );

  return changed ? replaced : null;
}

module.exports = function legacyWebkitCompatPlugin() {
  return {
    postcssPlugin: "solgames-legacy-webkit-compat",
    OnceExit(root) {
      const rootVars = new Map();

      root.walkRules((rule) => {
        if (rule.selector.includes(":root") || rule.selector.includes(":host")) {
          rule.walkDecls((decl) => {
            if (decl.prop.startsWith("--") && !rootVars.has(decl.prop)) {
              rootVars.set(decl.prop, decl.value.trim());
            }
          });
        }
      });

      const layerAtRules = [];
      root.walkAtRules("layer", (atRule) => {
        layerAtRules.push(atRule);
      });

      for (const atRule of layerAtRules) {
        if (!atRule.nodes || atRule.nodes.length === 0) {
          atRule.remove();
          continue;
        }
        if (atRule.params.trim() === "properties") {
          const extracted = [];
          atRule.each((child) => {
            if (
              child.type === "atrule" &&
              child.name === "supports" &&
              child.nodes
            ) {
              child.each((inner) => extracted.push(inner.clone()));
            } else {
              extracted.push(child.clone());
            }
          });
          atRule.replaceWith(...extracted);
        } else {
          atRule.replaceWith(...atRule.nodes);
        }
      }

      root.walkRules((rule) => {
        let hasTransformDecl = false;
        let hasWebkitBackdrop = false;
        let hasBoxEdges = false;

        rule.each((node) => {
          if (node.type !== "decl") return;
          if (node.prop === "transform") hasTransformDecl = true;
          if (node.prop === "-webkit-backdrop-filter") hasWebkitBackdrop = true;
          if (
            node.prop === "top" ||
            node.prop === "right" ||
            node.prop === "bottom" ||
            node.prop === "left"
          ) {
            hasBoxEdges = true;
          }
        });

        rule.each((node) => {
          if (node.type !== "decl") return;

          if (node.value.includes("color-mix(")) {
            const fallbackVal = buildColorMixFallback(node.value, rootVars);
            if (fallbackVal && fallbackVal !== node.value) {
              node.cloneBefore({ prop: node.prop, value: fallbackVal });
            }
          }

          if (/([0-9.]+)(?:dvh|svh|lvh)\b/.test(node.value)) {
            const vhFallback = node.value.replace(
              /([0-9.]+)(?:dvh|svh|lvh)\b/g,
              "$1vh"
            );
            if (vhFallback !== node.value) {
              node.cloneBefore({ prop: node.prop, value: vhFallback });
            }
          }

          if (node.prop === "backdrop-filter" && !hasWebkitBackdrop) {
            node.cloneBefore({
              prop: "-webkit-backdrop-filter",
              value: node.value,
            });
            hasWebkitBackdrop = true;
          }

          if (
            node.prop === "inset" &&
            !hasBoxEdges &&
            !/\s/.test(node.value.trim())
          ) {
            const edgeVal = node.value.trim();
            node.cloneBefore({ prop: "top", value: edgeVal });
            node.cloneBefore({ prop: "right", value: edgeVal });
            node.cloneBefore({ prop: "bottom", value: edgeVal });
            node.cloneBefore({ prop: "left", value: edgeVal });
          }

          if (
            !hasTransformDecl &&
            node.value !== "initial" &&
            node.value !== "none"
          ) {
            if (node.prop === "translate") {
              const parts = node.value.trim().split(/\s+/);
              const tx = parts[0] || "0";
              const ty = parts[1] || "0";
              node.cloneBefore({
                prop: "transform",
                value: `translate(${tx}, ${ty})`,
              });
            } else if (node.prop === "scale") {
              const parts = node.value.trim().split(/\s+/);
              const sx = parts[0] || "1";
              const sy = parts[1] || sx;
              node.cloneBefore({
                prop: "transform",
                value: sx === sy ? `scale(${sx})` : `scale(${sx}, ${sy})`,
              });
            } else if (node.prop === "rotate") {
              node.cloneBefore({
                prop: "transform",
                value: `rotate(${node.value.trim()})`,
              });
            }
          }
        });
      });
    },
  };
};

module.exports.postcss = true;
