/**
 * config.js
 * Style Dictionary v4 configuration for Android Jetpack Compose output.
 *
 * Reads tokens from: tokens/converted/*.json
 * Outputs to:        tokens/build/android/
 *
 * Each token category generates its own JSON file that writeFoundation.js
 * later uses to produce the .kt files.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import composeColorTransform from './transforms/composeColor.js';
import { composeDpTransform, composeSpTransform, composeFloatTransform } from './transforms/composeDimension.js';
import { composeTypographyTransform } from './transforms/composeTypography.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

// ─── Custom format: emits per-category JSON consumed by writeFoundation.js ───
// (Style Dictionary build outputs JSON; writeFoundation.js converts to Kotlin)
// SD v4 hooks.formats expects the value to be the formatter function directly.
const composeFoundationJsonFormat = ({ dictionary }) => {
  // Build a clean map: tokenName → { category, value, description }
  const out = {};
  for (const token of dictionary.allTokens) {
    const transformedValue = token.value;
    out[token.name] = {
      name: token.name,
      path: token.path,
      category: token.attributes?.category ?? token.path[0] ?? 'misc',
      originalType: token.attributes?.type ?? '',
      value: transformedValue,
      description: token.comment ?? token.description ?? '',
    };
  }
  return JSON.stringify(out, null, 2);
};

// ─── Config Export ────────────────────────────────────────────────────────────
export default {
  source: [`${ROOT}/tokens/converted/**/*.json`],

  // Tokens use legacy `value` (not DTCG `$value`), so disable DTCG auto-detect.
  // The presence of `$type` on tokens would otherwise trigger usesDtcg: true.
  usesDtcg: false,

  // Register our custom transforms at config level (Style Dictionary v4 API)
  hooks: {
    transforms: {
      [composeColorTransform.name]: composeColorTransform,
      [composeDpTransform.name]: composeDpTransform,
      [composeSpTransform.name]: composeSpTransform,
      [composeFloatTransform.name]: composeFloatTransform,
      [composeTypographyTransform.name]: composeTypographyTransform,
    },
    formats: {
      'compose/foundation-json': composeFoundationJsonFormat,
    },
    transformGroups: {
      'compose-android': [
        'attribute/cti',           // Populates token.attributes.category/type/item
        'name/camel',              // camelCase token names for Kotlin val names
        composeColorTransform.name,
        composeDpTransform.name,
        composeSpTransform.name,
        composeFloatTransform.name,
        composeTypographyTransform.name,
      ],
    },
  },

  platforms: {
    'compose-android': {
      transformGroup: 'compose-android',
      buildPath: `${ROOT}/tokens/build/android/`,
      files: [
        {
          destination: 'colors.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'colors' ||
            token.$type === 'color',
        },
        {
          destination: 'typography.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'typography' ||
            token.$type === 'typography',
        },
        {
          destination: 'dimensions.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'dimensions' ||
            token.$type === 'dimension' ||
            token.$type === 'spacing',
        },
        {
          destination: 'borders.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'borders' ||
            token.$type === 'border' ||
            token.$type === 'borderRadius',
        },
        {
          destination: 'elevation.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'elevation' ||
            token.$type === 'shadow' ||
            token.$type === 'effect',
        },
        {
          destination: 'opacity.json',
          format: 'compose/foundation-json',
          filter: token =>
            token.attributes?.category === 'opacity' ||
            token.$type === 'opacity',
        },
      ],
    },
  },
};
