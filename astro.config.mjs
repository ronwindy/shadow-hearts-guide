import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { readFileSync } from 'node:fs';

const project = JSON.parse(readFileSync(new URL('./project.config.json', import.meta.url), 'utf8'));

// https://astro.build/config
export default defineConfig({
  site: project.site,
  base: project.base,
  output: 'static',
  build: {
    format: 'file'
  },
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
  ],
});
