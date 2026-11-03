import Color from 'colorjs.io';

export class ColorUtil {
  public static createGradient(numColors: number): string[] {
    const colors: string[] = [];

    const color1 = new Color('rebeccapurple');
    const color2 = new Color('lch', [95, 95, 95 + 720]);
    const gradient = color1.range(color2, { hue: 'raw', outputSpace: 'srgb', space: 'lch' });

    for (let i = 0; i < numColors; i++) {
      const t = numColors === 1 ? 0 : i / (numColors - 1);
      colors.push(gradient(t).toString({ format: 'hex' }));
    }
    return colors;
  }

  public static getDeterministicColor(gradient: string[], value: string, index: number, missingValueColor: string): string {
    if (ColorUtil.isMissingValue(value)) {
      return missingValueColor; // Missing value color
    }
    return gradient[index];
  }

  public static isMissingValue(value: string): boolean {
    return !value || value === '-' || value.toLowerCase() === 'na' || value.toLowerCase() === 'null';
  }
}
