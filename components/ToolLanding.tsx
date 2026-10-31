import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Cloud } from "lucide-react";
import { ToolPageProvider } from "./ToolPageContext";
import { toolPageBySlug, type ToolPage } from "@/app/lib/toolPages";

const siteUrl = "https://www.easytoconvert.in";

function page(slug: string): ToolPage {
  const tool = toolPageBySlug(slug);
  if (!tool) throw new Error(`Unknown tool page: ${slug}`);
  return tool;
}

export function toolMetadata(slug: string): Metadata {
  const tool = page(slug);
  const url = `${siteUrl}/${tool.slug}`;
  return {
    title: tool.title,
    description: tool.description,
    alternates: { canonical: url },
    openGraph: {
      title: tool.title,
      description: tool.description,
      url,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: tool.name }],
    },
    twitter: { card: "summary_large_image", title: tool.title, description: tool.description },
  };
}

// JSON-LD must not be able to close the <script> tag.
const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, "\\u003c") });

/** A dedicated, indexable tool page: the hub tool opened in this page's mode, plus how-to and FAQ content. */
export function ToolLanding({ slug, Tool }: { slug: string; Tool: React.ComponentType }) {
  const tool = page(slug);
  const url = `${siteUrl}/${tool.slug}`;
  const related = tool.related.map(toolPageBySlug).filter((t): t is ToolPage => Boolean(t));

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebApplication",
        "@id": `${url}#application`,
        name: `EasyToConvert ${tool.name}`,
        url,
        description: tool.description,
        applicationCategory: tool.appCategory,
        operatingSystem: "Any operating system with a modern web browser",
        browserRequirements: "Requires JavaScript",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        mainEntity: tool.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <div className="space-y-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(structuredData)} />

      <ToolPageProvider value={{ mode: tool.mode, h1: tool.h1, intro: tool.intro, name: tool.name }}>
        <Tool />
      </ToolPageProvider>

      <div className="lg:pl-[25%] lg:ml-1.5 space-y-8 text-sm text-slate-600 dark:text-slate-300">
        <section aria-labelledby="how-to" className="glass-card p-6 space-y-4">
          <h2 id="how-to" className="text-lg font-bold text-slate-900 dark:text-white">How to use the {tool.name} tool</h2>
          <ol className="space-y-3">
            {tool.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="good-to-know" className="glass-card p-6 space-y-4">
          <h2 id="good-to-know" className="text-lg font-bold text-slate-900 dark:text-white">Good to know</h2>
          <ul className="space-y-2.5">
            {tool.points.map((point, i) => (
              <li key={i} className="flex gap-2.5">
                {i === 0 ? (
                  tool.cloud ? <Cloud className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-500" /> : <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-500" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-indigo-500" />
                )}
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="glass-card p-6 space-y-4">
          <h2 id="faq" className="text-lg font-bold text-slate-900 dark:text-white">Frequently asked questions</h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {tool.faqs.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="cursor-pointer list-none font-semibold text-slate-800 dark:text-slate-100 flex justify-between gap-4">
                  <h3 className="text-sm">{f.q}</h3>
                  <span aria-hidden="true" className="text-indigo-500 group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-2 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {related.length > 0 && (
          <section aria-labelledby="related" className="space-y-3">
            <h2 id="related" className="text-lg font-bold text-slate-900 dark:text-white">Related tools</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {related.map((r) => (
                <Link key={r.slug} href={`/${r.slug}`} className="glass-card p-4 hover:border-indigo-500/50 transition-all">
                  <span className="font-semibold text-slate-900 dark:text-white block">{r.name}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{r.description}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
