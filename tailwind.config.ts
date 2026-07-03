import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 is CSS-first (tokens live in src/ui/theme/tokens.css via @theme).
 * This file only pins content globs for editors/tooling that still read it.
 */
const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/ui/**/*.{ts,tsx}',
    './src/modules/**/*.{ts,tsx}',
  ],
};

export default config;
