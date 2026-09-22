"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchTools, type ToolCategory } from "@/app/lib/toolRegistry";
import { announceTool } from "@/app/lib/toolLaunch";

const tags: Record<ToolCategory, string> = { PDF: "PDF", Image: "IMG", Developer: "DEV", "AI / Data": "DATA", Media: "MEDIA" };

export default function CommandPalette() {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();
  const router = useRouter();
  const results = useMemo(() => searchTools(query), [query]);
  const index = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && !event.isComposing) {
        event.preventDefault();
        if (!event.repeat) setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  useEffect(() => {
    if (!open) return;
    opener.current = document.activeElement as HTMLElement;
    setQuery("");
    setActive(0);
    dialog.current?.showModal(); // Native modal supplies background inertness and a focus trap.
    input.current?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      opener.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-option-${index}`)?.scrollIntoView({ block: "nearest" });
  }, [index, id, open, query]);

  const select = (href: string) => { setOpen(false); announceTool(href); router.push(href); };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
      aria-label="Search tools" className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500">
      <span aria-hidden="true" className="sm:hidden">⌕</span><span className="hidden lg:inline">Search tools </span><kbd className="hidden text-xs sm:inline">⌘ / Ctrl K</kbd>
    </button>
    <dialog ref={dialog} aria-labelledby={`${id}-title`} onCancel={(e) => { e.preventDefault(); setOpen(false); }}
      onKeyDown={(e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          if (document.activeElement === input.current) close.current?.focus();
          else input.current?.focus();
        }
      }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
      className="command-dialog fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id={`${id}-title`} className="font-semibold">Find your next tool</h2>
          <button ref={close} type="button" onClick={() => setOpen(false)} aria-label="Close tool search" className="rounded border border-slate-300 px-2 py-1 text-xs dark:border-slate-600">Esc</button>
        </div>
        <input ref={input} role="combobox" aria-label="Search tools" aria-autocomplete="list" aria-expanded="true"
          aria-controls={`${id}-results`} aria-activedescendant={results.length ? `${id}-option-${index}` : undefined}
          aria-describedby={`${id}-help`} value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (results.length) setActive((index + (e.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
            } else if (e.key === "Enter" && results[index]) { e.preventDefault(); select(results[index].href); }
          }} placeholder="Search tools, categories, or keywords…"
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-950" />
        <p role="status" className="sr-only">{results.length} tools found</p>
        <ul id={`${id}-results`} role="listbox" aria-label="Tools" className="mt-3 max-h-[min(55dvh,24rem)] space-y-1 overflow-y-auto">
          {results.map((tool, i) => <li key={tool.id} id={`${id}-option-${i}`} role="option" aria-selected={index === i}
            onMouseDown={(e) => e.preventDefault()} onClick={() => select(tool.href)} onPointerMove={() => setActive(i)}
            className={`cursor-pointer rounded-lg px-3 py-3 ${index === i ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-500/20 dark:text-indigo-100" : "hover:bg-slate-100 dark:hover:bg-slate-800"}`}>
            <div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">{tool.name}</span><span className="rounded border border-current px-1.5 py-0.5 text-[10px]">{tags[tool.category]}</span></div>
            {tool.note && <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{tool.note}</p>}
          </li>)}
        </ul>
        {!results.length && <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">No tools found. Try “PDF”, “image”, or “JSON”.</p>}
        <p id={`${id}-help`} className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400"><kbd>↑ ↓</kbd> Navigate · <kbd>Enter</kbd> Open · <kbd>Esc</kbd> Close</p>
      </div>
    </dialog>
  </>;
}
