// Ink Basin's colours as `src/styles/tokens.css` declares them, day and
// night, for the code that needs a value rather than a custom property.
// `tokens.test.ts` keeps the two in step and checks every text pairing.
export interface Theme {
  readonly page: string;
  readonly water: string;
  readonly text: string;
  readonly text2: string;
  readonly text3: string;
  readonly line: string;
  readonly edge: string;
  readonly seal: string;
  readonly ink1: string;
  readonly ink2: string;
  readonly ink3: string;
  readonly ink4: string;
  readonly inkFresh: string;
}

export const palette: { readonly day: Theme; readonly night: Theme } = {
  day: {
    page: "#F1F3F6",
    water: "#FBFBFC",
    text: "#0A1A33",
    text2: "#4F5C73",
    text3: "#5E6A7E",
    line: "#D3D9E2",
    edge: "#768296",
    seal: "#A63D2A",
    ink1: "#0A1A33",
    ink2: "#1E2D4A",
    ink3: "#606D80",
    ink4: "#AEB6C2",
    inkFresh: "#23468F",
  },
  night: {
    page: "#0B1426",
    water: "#0F1D34",
    text: "#E6EBF2",
    text2: "#AEB6C2",
    text3: "#8693A8",
    line: "#24324D",
    edge: "#66738A",
    seal: "#E8836C",
    ink1: "#DDE2E8",
    ink2: "#AEB6C2",
    ink3: "#7A8597",
    ink4: "#47546A",
    inkFresh: "#8EA6FF",
  },
};

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
