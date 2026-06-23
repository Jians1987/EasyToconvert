"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

// Theme Context
type Theme = "light" | "dark";
type ThemeContextType = {
  theme: Theme;
  toggleTheme: () => void;
};
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Conversion Context
export interface ConversionHistoryItem {
  id: string;
  fileName: string;
  fileSize: number;
  toolType: string;
  status: "success" | "processing" | "failed";
  timestamp: number;
  downloadUrl?: string;
}

type ConversionContextType = {
  history: ConversionHistoryItem[];
  addHistoryItem: (item: Omit<ConversionHistoryItem, "id" | "timestamp">) => void;
  clearHistory: () => void;
  favorites: string[];
  toggleFavorite: (toolId: string) => void;
};
const ConversionContext = createContext<ConversionContextType | undefined>(undefined);

export function Providers({ children }: { children: React.ReactNode }) {
  // Theme State
  const [theme, setTheme] = useState<Theme>("dark");

  // localStorage can throw in private-browsing mode (Safari) or when full.
  const safeSetItem = (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`Unable to persist ${key}.`, e);
    }
  };

  useEffect(() => {
    let savedTheme: Theme | null = null;
    try {
      savedTheme = localStorage.getItem("theme") as Theme;
    } catch {
      savedTheme = null;
    }
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else {
      // Default to dark mode for premium feel
      document.documentElement.classList.add("dark");
      safeSetItem("theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    safeSetItem("theme", nextTheme);
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  // Conversion History & Favorites State
  const [history, setHistory] = useState<ConversionHistoryItem[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("conversion_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error("Failed to load history", e);
    }

    const savedFavorites = (() => {
      try {
        return localStorage.getItem("tool_favorites");
      } catch {
        return null;
      }
    })();
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  // Persist history without crashing when localStorage quota is exceeded.
  // Conversions can store large base64 data URLs in `downloadUrl`; if the full
  // write fails we retry with metadata only (dropping the heavy data URLs).
  const persistHistory = (items: ConversionHistoryItem[]) => {
    try {
      localStorage.setItem("conversion_history", JSON.stringify(items));
    } catch {
      try {
        const slim = items.map(({ downloadUrl, ...rest }) => rest);
        localStorage.setItem("conversion_history", JSON.stringify(slim));
      } catch (e) {
        console.warn("Unable to persist conversion history (storage quota exceeded).", e);
      }
    }
  };

  const addHistoryItem = (item: Omit<ConversionHistoryItem, "id" | "timestamp">) => {
    const newItem: ConversionHistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 100); // limit to 100 entries
      persistHistory(updated);
      return updated;
    });
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("conversion_history");
  };

  const toggleFavorite = (toolId: string) => {
    setFavorites((prev) => {
      const updated = prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId];
      try {
        localStorage.setItem("tool_favorites", JSON.stringify(updated));
      } catch (e) {
        console.warn("Unable to persist favorites.", e);
      }
      return updated;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ConversionContext.Provider value={{ history, addHistoryItem, clearHistory, favorites, toggleFavorite }}>
        {children}
      </ConversionContext.Provider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

export function useConversions() {
  const context = useContext(ConversionContext);
  if (!context) throw new Error("useConversions must be used within ConversionProvider");
  return context;
}
