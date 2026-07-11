"use client";

import React, { createContext, useContext, useEffect, useState, useMemo } from "react";

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

// localStorage can throw in private-browsing mode (Safari) or when full.
function safeSetItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`Unable to persist ${key}.`, e);
  }
}

// Persist history without crashing when localStorage quota is exceeded.
// Conversions can store large base64 data URLs in `downloadUrl`; if the full
// write fails we retry with metadata only (dropping the heavy data URLs).
function persistHistory(items: ConversionHistoryItem[]) {
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
}

export function ConversionProvider({ children }: { children: React.ReactNode }) {
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

  const addHistoryItem = (item: Omit<ConversionHistoryItem, "id" | "timestamp">) => {
    const newItem: ConversionHistoryItem = {
      ...item,
      id: crypto.randomUUID(),
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
    try {
      localStorage.removeItem("conversion_history");
    } catch (e) {
      console.warn("Unable to clear persisted conversion history.", e);
    }
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

  const value = useMemo(
    () => ({ history, addHistoryItem, clearHistory, favorites, toggleFavorite }),
    [history, favorites]
  );

  return <ConversionContext.Provider value={value}>{children}</ConversionContext.Provider>;
}

export function useConversions() {
  const context = useContext(ConversionContext);
  if (!context) throw new Error("useConversions must be used within ConversionProvider");
  return context;
}
