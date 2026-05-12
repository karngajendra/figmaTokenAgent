/**
 * composeTypography.js
 * Custom Style Dictionary transforms for typography tokens.
 *
 * Figma typography tokens (from Variables API or Styles API) contain:
 *   fontFamily, fontWeight, fontSize, lineHeightPx, letterSpacing, textCase
 *
 * We output individual per-property tokens that the formatter assembles into
 * a TextStyle() in the generated .kt file.
 *
 * Transform name: 'typography/composeTextStyle'
 * Type: 'value'
 */

export const composeTypographyTransform = {
  name: 'typography/composeTextStyle',
  type: 'value',
  filter: token => token.attributes?.category === 'typography' || token.$type === 'typography',
  transform: token => {
    const v = token.$value ?? token.value;
    return toTextStyle(v);
  },
};

/**
 * Maps font weight names/numbers to Compose FontWeight constants.
 */
const FONT_WEIGHT_MAP = {
  100: 'FontWeight.Thin',
  200: 'FontWeight.ExtraLight',
  300: 'FontWeight.Light',
  400: 'FontWeight.Normal',
  500: 'FontWeight.Medium',
  600: 'FontWeight.SemiBold',
  700: 'FontWeight.Bold',
  800: 'FontWeight.ExtraBold',
  900: 'FontWeight.Black',
  thin: 'FontWeight.Thin',
  extralight: 'FontWeight.ExtraLight',
  light: 'FontWeight.Light',
  regular: 'FontWeight.Normal',
  normal: 'FontWeight.Normal',
  medium: 'FontWeight.Medium',
  semibold: 'FontWeight.SemiBold',
  bold: 'FontWeight.Bold',
  extrabold: 'FontWeight.ExtraBold',
  black: 'FontWeight.Black',
};

function resolveFontWeight(fw) {
  if (!fw) return 'FontWeight.Normal';
  const key = typeof fw === 'string' ? fw.toLowerCase().replace(/\s+/g, '') : fw;
  return FONT_WEIGHT_MAP[key] ?? `FontWeight(${fw})`;
}

function toTextStyle(v) {
  if (!v || typeof v !== 'object') return 'TextStyle()';

  const parts = [];

  if (v.fontFamily) {
    parts.push(`fontFamily = FontFamily(Font("${v.fontFamily}"))`);
  }

  if (v.fontWeight !== undefined) {
    parts.push(`fontWeight = ${resolveFontWeight(v.fontWeight)}`);
  }

  if (v.fontSize !== undefined) {
    parts.push(`fontSize = ${parseFloat(v.fontSize)}.sp`);
  }

  if (v.lineHeightPx !== undefined && v.lineHeightPx > 0) {
    parts.push(`lineHeight = ${parseFloat(v.lineHeightPx).toFixed(1)}.sp`);
  }

  if (v.letterSpacing !== undefined && v.letterSpacing !== 0) {
    parts.push(`letterSpacing = ${parseFloat(v.letterSpacing).toFixed(2)}.sp`);
  }

  if (parts.length === 0) return 'TextStyle()';
  return `TextStyle(\n        ${parts.join(',\n        ')}\n    )`;
}
