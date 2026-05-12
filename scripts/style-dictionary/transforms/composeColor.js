/**
 * composeColor.js
 * Custom Style Dictionary transform: Figma RGBA (0-1 floats) → Compose Color(0xAARRGGBB)
 *
 * Handles both Variables API COLOR objects and hex string values.
 */

export default {
  name: 'color/composeColor',
  type: 'value',
  filter: token => token.type === 'color' || token.$type === 'color' || token.attributes?.category === 'colors',
  transform: token => {
    const v = token.$value ?? token.value;
    return figmaColorToCompose(v);
  },
};

/**
 * Converts a Figma color value to a Compose Color() hex string.
 * Accepts:
 *   - { type: "COLOR", r, g, b, a }  ← Variables API (0-1 range)
 *   - "#RRGGBB" or "#AARRGGBB"        ← already normalised hex
 *   - "rgb(r, g, b)"
 */
export function figmaColorToCompose(value) {
  if (!value) return 'Color.Unspecified';

  // Variables API object
  if (typeof value === 'object' && value.type === 'COLOR') {
    return rgbaToCompose(value.r, value.g, value.b, value.a ?? 1);
  }

  // Plain object with r/g/b/a (also Variables API format without type key)
  if (typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    return rgbaToCompose(value.r, value.g, value.b, value.a ?? 1);
  }

  // Hex string "#RRGGBB" or "#AARRGGBB"
  if (typeof value === 'string' && value.startsWith('#')) {
    return hexToCompose(value);
  }

  return 'Color.Unspecified';
}

function rgbaToCompose(r, g, b, a) {
  const toHex = n => Math.round(n * 255).toString(16).padStart(2, '0').toUpperCase();
  return `Color(0x${toHex(a)}${toHex(r)}${toHex(g)}${toHex(b)})`;
}

function hexToCompose(hex) {
  const clean = hex.replace('#', '');
  if (clean.length === 6) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(clean.slice(i, i + 2), 16) / 255);
    return rgbaToCompose(r, g, b, 1);
  }
  if (clean.length === 8) {
    // #AARRGGBB (Android convention) or #RRGGBBAA (web convention) — treat as #AARRGGBB
    const a = parseInt(clean.slice(0, 2), 16) / 255;
    const r = parseInt(clean.slice(2, 4), 16) / 255;
    const g = parseInt(clean.slice(4, 6), 16) / 255;
    const b = parseInt(clean.slice(6, 8), 16) / 255;
    return rgbaToCompose(r, g, b, a);
  }
  return 'Color.Unspecified';
}
