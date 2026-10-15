// The world's colours as `src/styles/tokens.css` declares them, for the code
// that needs a value rather than a custom property. `tokens.test.ts` keeps the
// two in step and checks every text pairing the spec allows.
export const palette = {
  cobalt: "#1A33FF",
  magenta: "#FF2DA6",
  errorMagenta: "#C2007A",
  lemon: "#FFE600",
  ink: "#111111",
  plate: "#F7F4ED",
  white: "#FFFFFF",
} as const;

const channel = (value: number) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

// WCAG 2.2 relative luminance of a `#RRGGBB` colour.
export const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) =>
    channel(Number.parseInt(hex.slice(i, i + 2), 16)),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a: string, b: string): number => {
  const [light = 0, dark = 0] = [luminance(a), luminance(b)].sort(
    (x, y) => y - x,
  );
  return (light + 0.05) / (dark + 0.05);
};
