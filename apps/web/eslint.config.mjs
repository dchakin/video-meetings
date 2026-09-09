// @ts-check
// Конфиг, сгенерированный модулем @nuxt/eslint (доступен после `nuxt prepare`).
import withNuxt from './.nuxt/eslint.config.mjs';
import base from '@video-meetings/eslint-config/base';

// Общие правила применяем только к JS/TS-файлам, чтобы не перебивать
// vue-eslint-parser, который Nuxt настраивает для *.vue.
const scopedBase = base.map((config) =>
  Object.keys(config).length === 1 && config.ignores
    ? config
    : { ...config, files: config.files ?? ['**/*.{js,mjs,cjs,ts,mts,cts}'] },
);

export default withNuxt(...scopedBase).append({
  name: 'web/ignores',
  ignores: ['.nuxt/**', '.output/**', '.data/**', 'dist/**'],
});
