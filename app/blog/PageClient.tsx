import Link from "next/link";
import { Calendar, Clock, ChevronRight } from "lucide-react";
import { blogPosts } from "@/app/lib/blogPosts";

export const formatDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Server-rendered so the article list is in the HTML search engines crawl.
export function BlogPageClient() {
  return (
    <div className="space-y-12 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Articles &amp; Guides</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto">
          Practical, step-by-step guides for everyday file tasks — PDFs, images, spreadsheets and data.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {blogPosts.map((post) => (
          <article key={post.slug} className="glass-card p-6 flex flex-col justify-between">
            <div className="space-y-3">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-snug">
                <Link href={`/blog/${post.slug}`} className="hover:text-indigo-500">{post.title}</Link>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{post.description}</p>
            </div>

            <div className="pt-5 mt-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-4 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <time dateTime={post.published}>{formatDate(post.published)}</time>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{post.readMinutes} min read</span>
                </span>
              </div>
              <Link href={`/blog/${post.slug}`} aria-label={`Read: ${post.title}`} className="text-xs font-bold text-indigo-500 flex items-center gap-1 hover:underline">
                <span>Read Article</span>
                <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
