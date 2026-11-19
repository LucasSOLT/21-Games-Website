/**
 * PostCSS Legacy WebKit / Embedded WebView Compatibility Plugin for 21 Games.
 *
 * 1. Unwraps @layer blocks (properties, theme, base, components, utilities) in exact
 *    cascade order so Safari < 15.4 and embedded in-app WebViews apply 100% of Tailwind v4 rules.
 * 2. Emits rgba(...) / hsla(...) fallback declarations immediately before color-mix(in oklab, ...)
 *    declarations so iOS 15.4–16.3 renders translucent backgrounds, borders, and rings cleanly.
 * 3. Emits transform: translate(...)/scale(...) fallbacks before standalone CSS Transform Level 2
 *    properties for older mobile browsers.
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

      const varMatch = colorExpr.match(/^var\((--[a-zA-Z0-9_-]+)\)$/);
      if (varMatch) {
        const resolved = rootVars.get(varMatch[1]);
        if (resolved && resolved.startsWith("#")) {
          const rgb = hexToRgbTuple(resolved);
          if (rgb) {
            changed = true;
            return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
          }
        }
      }

      if (colorExpr.startsWith("#")) {
        const rgb = hexToRgbTuple(colorExpr);
        if (rgb) {
          changed = true;
          return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
        }
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
        rule.each((node) => {
          if (node.type === "decl" && node.prop === "transform") {
            hasTransformDecl = true;
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
            }
          }
        });
      });
    },
  };
};

module.exports.postcss = true;
