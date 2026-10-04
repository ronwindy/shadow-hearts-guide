import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://ronwindy.github.io',
  base: '/shadow-hearts-guide',
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
