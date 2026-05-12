/**
 * composeDimension.js
 * Custom Style Dictionary transforms for dimension/spacing/border tokens.
 *
 * Registers:
 *   size/composeDp   — numeric or "16px" → "16.dp"
 *   size/composeSp   — numeric font sizes → "16.sp"
 *   size/composeFloat — pure Float for border width, opacity, etc.
 */

export const composeDpTransform = {
  name: 'size/composeDp',
  type: 'value',
  filter: token => {
    const cat = token.attributes?.category;
    return cat === 'dimensions' || cat === 'borders' || cat === 'elevation' ||
           token.$type === 'dimension' || token.$type === 'spacing';
  },
  transform: token => {
    const raw = token.$value ?? token.value;
    return toDp(raw);
  },
};

export const composeSpTransform = {
  name: 'size/composeSp',
  type: 'value',
  filter: token => {
    const cat = token.attributes?.category;
    return cat === 'typography' ||
           token.$type === 'fontSizes' || token.$type === 'fontSize';
  },
  transform: token => {
    const raw = token.$value ?? token.value;
    return toSp(raw);
  },
};

export const composeFloatTransform = {
  name: 'size/composeFloat',
  type: 'value',
  filter: token => {
    const cat = token.attributes?.category;
    return cat === 'opacity';
  },
  transform: token => {
    const raw = token.$value ?? token.value;
    const n = parseNumber(raw);
    // Opacity stored as 0-100 in Figma, output as 0f-1f
    if (n > 1) return `${(n / 100).toFixed(2)}f`;
    return `${n.toFixed(2)}f`;
  },
};

function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null) {
    // FLOAT type from Variables API: { type: "FLOAT", value: 16 }
    return value.value ?? 0;
  }
  // "16px", "16.0", "16"
  return parseFloat(String(value).replace(/[^0-9.]/g, '')) || 0;
}

function toDp(value) {
  const n = parseNumber(value);
  return `${n}.dp`;
}

function toSp(value) {
  const n = parseNumber(value);
  return `${n}.sp`;
}
