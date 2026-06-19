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

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme;
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
      localStorage.setItem("theme", "dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
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
    const savedHistory = localStorage.getItem("conversion_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    const savedFavorites = localStorage.getItem("tool_favorites");
    if (savedFavorites) {
      try {
        setFavorites(JSON.parse(savedFavorites));
      } catch (e) {
        console.error("Failed to parse favorites", e);
      }
    }
  }, []);

  const addHistoryItem = (item: Omit<ConversionHistoryItem, "id" | "timestamp">) => {
    const newItem: ConversionHistoryItem = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const updated = [newItem, ...prev].slice(0, 100); // limit to 100 entries
      localStorage.setItem("conversion_history", JSON.stringify(updated));
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
      localStorage.setItem("tool_favorites", JSON.stringify(updated));
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
