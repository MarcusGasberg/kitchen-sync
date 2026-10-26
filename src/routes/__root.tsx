import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SiteNavigation } from "#/ui/site-navigation";
import { ThemeColor } from "#/ui/theme-color";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1, viewport-fit=cover",
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
        <ThemeColor />
      </head>
      <body>
        <SiteNavigation />
        {children}
        <Scripts />
      </body>
    </html>
  );
}
