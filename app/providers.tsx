"use client";

import React from "react";
import { ThemeProvider } from "@/app/context/ThemeContext";
import { ConversionProvider } from "@/app/context/ConversionContext";

// Re-export types and hooks so existing imports from "@/app/providers" continue to work.
export type { ConversionHistoryItem } from "@/app/context/ConversionContext";
export { useTheme } from "@/app/context/ThemeContext";
export { useConversions } from "@/app/context/ConversionContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConversionProvider>{children}</ConversionProvider>
    </ThemeProvider>
  );
}

