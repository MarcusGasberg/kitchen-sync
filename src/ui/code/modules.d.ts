// The imports the snippet plugin (src/build/snippet-plugin.ts) answers. The
// flag comes last because a pattern takes one wildcard.
declare module "*&snippet" {
  const snippet: import("#/ui/code/snippet").Snippet;
  export default snippet;
}

declare module "*&morph" {
  const morph: import("#/ui/code/snippet").Morph;
  export default morph;
}
