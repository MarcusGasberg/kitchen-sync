import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { useRef } from "react";
import {
  type ClientRuntime,
  StoreRuntimeContext,
  useSyncService,
} from "#/lib/react";
import { StoreService } from "#/lib/store";
import { SyncEngineService } from "#/lib/sync";
import { SyncTransportService } from "#/lib/transport";
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
  const runtimeRef = useRef<ClientRuntime | null>(null);
  if (runtimeRef.current === null) {
    const mergedLayer = SyncEngineService.Live.pipe(
      Layer.provideMerge(
        Layer.mergeAll(
          StoreService.Live,
          SyncTransportService.Live.pipe(
            Layer.provideMerge(FetchHttpClient.layer),
          ),
        ),
      ),
    );
    runtimeRef.current = ManagedRuntime.make(mergedLayer);
  }

  useSyncService(runtimeRef.current);

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
