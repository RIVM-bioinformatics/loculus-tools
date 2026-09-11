const PALETTE = [
  '#0284C7', // Sky Blue
  '#16A34A', // Green
  '#EA580C', // Orange
  '#9333EA', // Purple
  '#DC2626', // Red
  '#0D9488', // Teal
  '#CA8A04', // Amber
  '#4F46E5', // Indigo
  '#DB2777', // Pink
  '#65A30D', // Lime
  '#0891B2', // Cyan
  '#D97706', // Yellow-Orange
  '#7C3AED', // Violet
  '#059669', // Emerald
  '#E11D48', // Rose
  '#2563EB', // Blue
  '#84CC16', // Light Green
  '#94A3B8', // Slate
];


export class ColorUtil {
  public static generateDeterministicColor(value: string, index = 0): string {
    if (!value || value === '-' || value.toLowerCase() === 'na' || value.toLowerCase() === 'null') {
      return '#94A3B8'; // Missing value color
    }
    if (index < PALETTE.length) {
      return PALETTE[index];
    }
    // Hash-based HSL color fallback for large number of unique categories
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 45%)`;
  }
}
