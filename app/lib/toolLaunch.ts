"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Ephemeral handoff only: never serialize file contents to storage or a URL.
let pending: { file: File; path: string } | null = null;
export function stageFile(file: File, href: string) { pending = { file, path: href.split("#")[0] }; }
export function announceTool(href: string) {
  window.dispatchEvent(new CustomEvent("easy-tool-launch", { detail: href }));
}
export function takeFile(path: string) {
  if (!pending || pending.path !== path) return null;
  const file = pending.file;
  pending = null;
  return file;
}
export function useToolMode<T extends string>(setMode: (mode: T) => void, allowed: readonly T[], special?: (hash: string) => boolean) {
  const latest = useRef({ setMode, allowed, special });
  latest.current = { setMode, allowed, special };
  useEffect(() => {
    const sync = () => {
      const { setMode, allowed, special } = latest.current;
      const hash = window.location.hash.slice(1);
      if (special?.(hash)) return;
      if (allowed.includes(hash as T)) setMode(hash as T);
    };
    sync();
    const launch = (event: Event) => {
      const [path, hash] = (event as CustomEvent<string>).detail.split("#");
      if (window.location.pathname !== path) return;
      const { setMode, allowed, special } = latest.current;
      if (special?.(hash)) return;
      if (allowed.includes(hash as T)) setMode(hash as T);
    };
    window.addEventListener("hashchange", sync);
    window.addEventListener("easy-tool-launch", launch);
    return () => { window.removeEventListener("hashchange", sync); window.removeEventListener("easy-tool-launch", launch); };
  }, []);
}
export function useStagedFile(onFile: (file: File) => void) {
  const pathname = usePathname();
  useEffect(() => {
    const file = takeFile(pathname);
    if (file) onFile(file);
  }, [pathname, onFile]);
}
