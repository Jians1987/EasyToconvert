import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Clock } from "lucide-react";
import { blogPostBySlug, blogPosts } from "@/app/lib/blogPosts";
import { toolPageBySlug, type ToolPage } from "@/app/lib/toolPages";
import { formatDate } from "../PageClient";

const siteUrl = "https://www.easytoconvert.in";

export const dynamicParams = false;
export const generateStaticParams = () => blogPosts.map((p) => ({ slug: p.slug }));

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = blogPostBySlug((await params).slug);
  if (!post) return {};
  const url = `${siteUrl}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.description,
      url,
      publishedTime: post.published,
      modifiedTime: post.updated ?? post.published,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = blogPostBySlug((await params).slug);
  if (!post) notFound();
  const tools = post.tools.map(toolPageBySlug).filter((t): t is ToolPage => Boolean(t));
  const url = `${siteUrl}/blog/${post.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    datePublished: post.published,
    dateModified: post.updated ?? post.published,
    image: `${siteUrl}/og-image.png`,
    author: { "@type": "Organization", name: "EasyToConvert", url: siteUrl },
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en",
  };

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <Link href="/blog" className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 hover:text-indigo-500">
        <ArrowLeft className="w-3.5 h-3.5" /> All guides
      </Link>

      <header className="space-y-4">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">{post.title}</h1>
        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /><time dateTime={post.published}>{formatDate(post.published)}</time></span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readMinutes} min read</span>
        </div>
        <p className="text-base leading-relaxed text-slate-700 dark:text-slate-300">{post.intro}</p>
      </header>

      {post.sections.map((section) => (
        <section key={section.heading} className="space-y-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{section.heading}</h2>
          {section.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          {section.list && (
            <ul className="list-disc pl-5 space-y-1.5">
              {section.list.map((item) => <li key={item}>{item}</li>)}
            </ul>
          )}
        </section>
      ))}

      {tools.length > 0 && (
        <aside aria-labelledby="tools-heading" className="glass-card p-6 space-y-4">
          <h2 id="tools-heading" className="text-lg font-bold text-slate-900 dark:text-white">Tools used in this guide</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tools.map((t) => (
              <Link key={t.slug} href={`/${t.slug}`} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:border-indigo-500/60 transition-all">
                <span className="font-semibold text-sm text-slate-900 dark:text-white block">{t.name}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Free · in your browser</span>
              </Link>
            ))}
          </div>
        </aside>
      )}
    </article>
  );
}
