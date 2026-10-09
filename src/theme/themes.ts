// The six themes (Appendix C 3). Colors live in tokens.css; this list drives the picker swatches.
export interface ThemeInfo {
  id: string;
  name: string;
  dark: boolean;
  swatch: [string, string, string, string]; // background, card, accent, text
}

export const THEMES: ThemeInfo[] = [
  { id: 'gold-cream', name: 'Gold and Cream', dark: false, swatch: ['#FBF7EE', '#FFFFFF', '#B8892B', '#2A2418'] },
  { id: 'sakura', name: 'Sakura', dark: false, swatch: ['#FFF6F8', '#FFFFFF', '#D4688A', '#3A2830'] },
  { id: 'ocean', name: 'Ocean', dark: false, swatch: ['#F1F7FA', '#FFFFFF', '#1F7FA8', '#12303F'] },
  { id: 'forest-ember', name: 'Forest and Ember', dark: false, swatch: ['#F3F5EC', '#FFFFFF', '#2F6B3F', '#D9742B'] },
  { id: 'black-gold', name: 'Black and Gold', dark: true, swatch: ['#0B0B0C', '#161617', '#D4AF37', '#F5F0E1'] },
  { id: 'black-panther', name: 'Black Panther', dark: true, swatch: ['#09080D', '#14111C', '#8B5CF6', '#C9CED6'] },
];

export const themeName = (id: string): string => THEMES.find((t) => t.id === id)?.name ?? 'Gold and Cream';
