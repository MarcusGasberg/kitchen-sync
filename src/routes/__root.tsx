import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { palette } from "#/ui/palette";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      {
        name: "theme-color",
        content: palette.day.page,
        media: "(prefers-color-scheme: light)",
      },
      {
        name: "theme-color",
        content: palette.night.page,
        media: "(prefers-color-scheme: dark)",
      },
      { title: "Kitchen Sync" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

// The shell every page shares, the series' included. It starts nothing: the
// app's runtime belongs to the `/` route.
function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
