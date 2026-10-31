"use client";

import { createContext, useContext } from "react";

// Set by a dedicated tool landing page (app/lib/toolPages.ts) to open a hub
// tool in a specific mode and give it the page's own heading.
export interface ToolPageInfo {
  mode: string;
  h1: string;
  intro: string;
  name: string;
}

const ToolPageContext = createContext<ToolPageInfo | null>(null);

export function ToolPageProvider({ value, children }: { value: ToolPageInfo; children: React.ReactNode }) {
  return <ToolPageContext.Provider value={value}>{children}</ToolPageContext.Provider>;
}

export const useToolPage = () => useContext(ToolPageContext);
