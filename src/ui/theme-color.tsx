import { palette } from "./palette";

// The browser's chrome takes the page's colour, by day and at night. The
// shell renders this in <head> itself: the router's head keeps only one meta
// per name, which would drop one of the two.
export function ThemeColor() {
  return (
    <>
      <meta
        name="theme-color"
        content={palette.day.page}
        media="(prefers-color-scheme: light)"
      />
      <meta
        name="theme-color"
        content={palette.night.page}
        media="(prefers-color-scheme: dark)"
      />
    </>
  );
}
