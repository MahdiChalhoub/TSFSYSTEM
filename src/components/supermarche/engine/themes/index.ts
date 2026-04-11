// ============================================================
// THEME INDEX — All Supermarché themes exported from one place
// Add a new theme: create a new file, import + add to THEMES.
// ============================================================

export interface SupermarcheThemeTokens {
 name: ThemeName;
 label: string;
 description: string;
 preview: {
 bg: string;
 primary: string;
 surface: string;
 text: string;
 };
 tokens: Record<string, string>;
}

export type ThemeName =
 | 'midnight-pro'
 | 'ivory-market'
 | 'neon-rush'
 | 'savane-earth'
 | 'arctic-glass';

export { midnightPro } from './midnight-pro';
export { ivoryMarket } from './ivory-market';
export { neonRush } from './neon-rush';
export { savaneEarth } from './savane-earth';
export { arcticGlass } from './arctic-glass';

import { midnightPro } from './midnight-pro';
import { ivoryMarket } from './ivory-market';
import { neonRush } from './neon-rush';
import { savaneEarth } from './savane-earth';
import { arcticGlass } from './arctic-glass';

/** Master registry — order determines display order in ThemeSelector */
export const THEMES: SupermarcheThemeTokens[] = [
 midnightPro,
 ivoryMarket,
 neonRush,
 savaneEarth,
 arcticGlass,
];

export const THEME_MAP: Record<ThemeName, SupermarcheThemeTokens> = {
 'midnight-pro': midnightPro,
 'ivory-market': ivoryMarket,
 'neon-rush': neonRush,
 'savane-earth': savaneEarth,
 'arctic-glass': arcticGlass,
};

export const DEFAULT_THEME: ThemeName = 'midnight-pro';
