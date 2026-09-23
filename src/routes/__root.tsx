import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { ManagedRuntime } from "effect";
import { useRef } from "react";
import { StoreRuntimeContext, StoreService } from "#/lib/store";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Kitchen Sync",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const runtimeRef = useRef<ManagedRuntime.ManagedRuntime<
    StoreService,
    never
  > | null>(null);
  if (runtimeRef.current === null) {
    runtimeRef.current = ManagedRuntime.make(StoreService.Live);
  }
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <StoreRuntimeContext value={runtimeRef.current}>
          {children}
        </StoreRuntimeContext>
        <Scripts />
      </body>
    </html>
  );
}
