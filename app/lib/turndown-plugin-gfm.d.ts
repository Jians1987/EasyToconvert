// turndown-plugin-gfm ships no type declarations. We only need the `gfm`
// aggregate plugin (tables + strikethrough + task lists); type it loosely as a
// turndown plugin so the dynamic import in wordToMarkdown.ts type-checks.
declare module "turndown-plugin-gfm" {
  import type TurndownService from "turndown";
  export const gfm: TurndownService.Plugin;
  export const tables: TurndownService.Plugin;
  export const strikethrough: TurndownService.Plugin;
  export const taskListItems: TurndownService.Plugin;
}
