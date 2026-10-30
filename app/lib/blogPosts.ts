// Blog articles. Each one answers a real question people search for and links
// to the tool that solves it. Keep advice accurate to what the tools do.

export interface BlogSection {
  heading: string;
  paragraphs: string[];
  list?: string[];
}

export interface BlogPost {
  slug: string;
  title: string; // <title> and H1
  description: string; // meta description and card excerpt
  published: string; // ISO date
  updated?: string;
  readMinutes: number;
  tools: string[]; // tool page slugs this article recommends
  intro: string;
  sections: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: "reduce-photo-size-for-online-forms",
    title: "How to Reduce Photo and Signature Size for Online Application Forms",
    description: "Exam, job and government forms often demand a photo under 50 KB or a signature under 20 KB at exact pixel sizes. Here's how to meet those limits without losing clarity.",
    published: "2026-10-30",
    readMinutes: 5,
    tools: ["resize-image", "compress-image", "png-to-jpg"],
    intro: "Online applications for exams, jobs, scholarships and government services almost always set strict rules for uploaded photos and signatures: a maximum file size in KB, sometimes a minimum, exact pixel dimensions, and usually JPG format. Uploads that miss any of these are rejected — often at the last step. Here's a reliable way to get it right the first time.",
    sections: [
      {
        heading: "Step 1: Read the exact requirements",
        paragraphs: ["Before editing anything, note down every rule in the form's instructions. Typical requirements look like this:"],
        list: [
          "Photo: JPG, 20–50 KB, 200 × 230 pixels",
          "Signature: JPG, 10–20 KB, 140 × 60 pixels",
          "Background: plain white or light colour",
        ],
      },
      {
        heading: "Step 2: Convert to JPG if needed",
        paragraphs: [
          "Phone screenshots and scans are often PNG files. Most forms only accept JPG, and PNG photos are much larger anyway. Convert them first with the PNG to JPG converter; transparent areas become white, which suits signature uploads.",
        ],
      },
      {
        heading: "Step 3: Resize to the required pixel dimensions",
        paragraphs: [
          "Resizing is the most effective way to cut file size, because the file stores every pixel. A 12-megapixel phone photo has roughly 250 times more pixels than a 200 × 230 form photo.",
          "Open Resize Image, enter the required width and height, and download. If the required shape differs from your photo's shape, crop the photo first so your face isn't stretched; keep the aspect-ratio lock on when you only need to match one dimension.",
        ],
      },
      {
        heading: "Step 4: Compress to get under the KB limit",
        paragraphs: [
          "After resizing, check the file size. If it's still above the limit, open Compress Image and lower the quality in small steps — 80%, then 70%, then 60% — downloading each time until the file fits. The tool shows the original and new size so you can see exactly where you are.",
          "If a form also has a minimum size (for example 20 KB) and your file is too small, raise the quality instead.",
        ],
      },
      {
        heading: "Common mistakes to avoid",
        paragraphs: [],
        list: [
          "Compressing a full-size photo to tiny quality instead of resizing first — the result looks blocky.",
          "Stretching a photo to new dimensions without cropping, which distorts faces.",
          "Uploading a signature photographed in dim light; sign on white paper in daylight for a clean, small file.",
          "Renaming a .png file to .jpg — the form may still detect it as PNG. Convert it properly.",
        ],
      },
      {
        heading: "Privacy note",
        paragraphs: [
          "Your ID photo and signature are sensitive. EasyToConvert's image tools run entirely in your browser, so the files are never uploaded to a server.",
        ],
      },
    ],
  },
  {
    slug: "how-to-compress-pdf-for-email",
    title: "How to Compress a PDF for Email and Upload Limits",
    description: "Gmail caps attachments at 25 MB and many portals at 1–5 MB. Learn why PDFs get large, how to shrink them, and what to do when compression isn't enough.",
    published: "2026-10-30",
    readMinutes: 4,
    tools: ["compress-pdf", "split-pdf", "compress-image"],
    intro: "A PDF that's too large to email or upload is one of the most common document headaches. Gmail and Outlook cap attachments at around 20–25 MB, and many government, university and job portals accept only 1–5 MB. The good news: most oversized PDFs can be shrunk dramatically.",
    sections: [
      {
        heading: "Why is my PDF so large?",
        paragraphs: [
          "Text barely takes any space — a 100-page text-only document is often under 1 MB. Large PDFs are almost always large because of images: scanned pages, phone photos of documents, or high-resolution pictures embedded in reports. A single page scanned at 600 dpi in colour can be several megabytes on its own.",
        ],
      },
      {
        heading: "Compress the PDF",
        paragraphs: [
          "Open Compress PDF, choose your file and pick a level:",
        ],
        list: [
          "Balanced — the recommended starting point; documents remain easy to read.",
          "Strong — the smallest file, good for meeting strict upload limits.",
          "Light — keeps more detail, for documents you'll print.",
        ],
      },
      {
        heading: "Know the trade-off",
        paragraphs: [
          "EasyToConvert compresses PDFs in your browser by re-rendering each page as a compressed image. That's very effective for scans and photo-heavy files — reductions of 50–90% are common — but text in the result can no longer be selected or searched. Keep your original if you need to copy text from it later.",
          "Text-only PDFs are already compact, so compressing them may not help. In that case the tool tells you and gives back your original rather than a bigger file.",
        ],
      },
      {
        heading: "Still too big? Split it",
        paragraphs: [
          "If one document must stay under a hard limit and is still too large, use Split PDF to break it into parts (for example pages 1-10 and 11-20) and send or upload them separately.",
        ],
      },
      {
        heading: "Prevent large PDFs in the first place",
        paragraphs: [],
        list: [
          "Scan documents at 150–200 dpi; 300 dpi is only needed for professional printing.",
          "Scan in greyscale unless colour matters.",
          "Resize and compress photos before inserting them into documents.",
        ],
      },
    ],
  },
  {
    slug: "convert-bank-statement-pdf-to-excel",
    title: "How to Convert a Bank Statement PDF to Excel",
    description: "Turn a bank or credit-card statement PDF into an Excel spreadsheet you can sort, filter and total — and what to do with scanned or password-protected statements.",
    published: "2026-10-30",
    readMinutes: 5,
    tools: ["pdf-to-excel", "image-to-text", "csv-to-json"],
    intro: "Banks send statements as PDFs, but budgeting, tax returns and expense reports need the transactions in a spreadsheet. Retyping hundreds of rows is slow and error-prone. Here's how to get them into Excel automatically.",
    sections: [
      {
        heading: "Step 1: Get the right kind of PDF",
        paragraphs: [
          "Statements downloaded from net banking are usually digital PDFs: the text is real text, aligned in columns. These convert best. A statement that was printed and scanned is just a picture of text and needs OCR (see below).",
        ],
      },
      {
        heading: "Step 2: Unlock it if it's password-protected",
        paragraphs: [
          "Many banks protect statements with a password, often based on your name and date of birth or customer ID. EasyToConvert detects protected PDFs and asks for the password; the file is unlocked locally in your browser.",
        ],
      },
      {
        heading: "Step 3: Convert to Excel",
        paragraphs: [
          "Open PDF to Excel, choose your statement and click Process PDF. Columns are detected from the positions of the text, header rows are styled, column widths are set automatically, and each table goes onto its own worksheet. Download the .xlsx and open it in Excel, Google Sheets or LibreOffice.",
        ],
      },
      {
        heading: "Step 4: Clean up the spreadsheet",
        paragraphs: ["A few quick fixes make the data ready for analysis:"],
        list: [
          "Delete repeated header rows that appear at the top of each page.",
          "Convert the date column with Excel's Text to Columns or DATEVALUE if dates are stored as text.",
          "Make sure amounts are numbers (right-aligned) so SUM and pivot tables work.",
          "Split a single Amount column into debit and credit using the Dr/Cr indicator if your bank uses one.",
        ],
      },
      {
        heading: "Scanned statements",
        paragraphs: [
          "For scanned statements, enable the Cloud AI option in PDF to Excel. It sends page images to an AI OCR service to read the table. Because a statement contains sensitive financial data, only use this option if you're comfortable sharing those page images with a third-party service; the default on-device mode never uploads your file.",
        ],
      },
    ],
  },
  {
    slug: "jpg-vs-png-vs-webp",
    title: "JPG vs PNG vs WebP: Which Image Format Should You Use?",
    description: "A practical guide to choosing between JPG, PNG and WebP — for photos, screenshots, logos and websites — with the trade-offs in file size, quality and transparency.",
    published: "2026-10-30",
    readMinutes: 4,
    tools: ["image-to-webp", "png-to-jpg", "jpg-to-png"],
    intro: "Picking the wrong image format makes files several times larger than necessary — or ruins a logo's transparent background. Here's when to use each of the three formats you'll meet most often.",
    sections: [
      {
        heading: "JPG: photos and anything you'll upload",
        paragraphs: [
          "JPG uses lossy compression tuned for photographs, so real-world photos stay small with little visible loss. It's accepted by virtually every website, form and app. It doesn't support transparency, and repeated editing and re-saving gradually degrades quality.",
        ],
        list: ["Use for: photos, application-form uploads, email attachments.", "Avoid for: logos, screenshots with text, images needing transparency."],
      },
      {
        heading: "PNG: screenshots, logos and transparency",
        paragraphs: [
          "PNG is lossless: every pixel is preserved exactly, which keeps text and sharp edges crisp. It supports transparency. The cost is size — a photo saved as PNG can be five to ten times larger than the same photo as JPG.",
        ],
        list: ["Use for: screenshots, logos, icons, graphics with text, images you'll keep editing.", "Avoid for: large photos, especially where upload size matters."],
      },
      {
        heading: "WebP: the best default for websites",
        paragraphs: [
          "WebP supports both lossy and lossless compression plus transparency. At similar quality, lossy WebP files are typically 25–35% smaller than JPG, which makes pages load faster — something both visitors and search engines reward. Every current browser supports it, but some older desktop software and upload forms still don't.",
        ],
        list: ["Use for: images on your own website or app.", "Avoid for: forms or systems that only list JPG or PNG."],
      },
      {
        heading: "Quick decision guide",
        paragraphs: [],
        list: [
          "Uploading to a form or sending to someone? JPG.",
          "Logo or anything needing a transparent background? PNG (or WebP on the web).",
          "Screenshot with text? PNG.",
          "Publishing on your website? WebP.",
        ],
      },
      {
        heading: "Converting between formats",
        paragraphs: [
          "Converting can't recover detail that's already been lost: turning a JPG into a PNG keeps it exactly as it is, artefacts included, just in a bigger file. Convert from the best original you have. EasyToConvert's converters run in your browser, so your images are never uploaded.",
        ],
      },
    ],
  },
  {
    slug: "json-vs-yaml-vs-csv",
    title: "JSON vs YAML vs CSV: Choosing a Data Format",
    description: "When to use JSON, YAML or CSV for APIs, configuration and spreadsheets — with the strengths, pitfalls and conversion tips for each format.",
    published: "2026-10-30",
    readMinutes: 4,
    tools: ["json-formatter", "json-to-yaml", "csv-to-json"],
    intro: "JSON, YAML and CSV all store structured data as plain text, but each suits a different job. Choosing well saves you from parsing bugs and unreadable files.",
    sections: [
      {
        heading: "JSON: the language of APIs",
        paragraphs: [
          "JSON represents nested objects and arrays with strict, simple syntax. Every programming language can read and write it, which is why nearly all web APIs use it. Its strictness is also its main annoyance: a single trailing comma or missing quote makes the whole document invalid, and it has no comments.",
          "Tip: when an API response or config won't parse, paste it into the JSON Formatter. It pretty-prints valid JSON and shows an error for invalid input.",
        ],
      },
      {
        heading: "YAML: configuration humans edit",
        paragraphs: [
          "YAML expresses the same structures as JSON using indentation instead of braces, and it allows comments. That makes it popular for configuration — Kubernetes manifests, Docker Compose, GitHub Actions. The catch is that indentation is meaningful: a misplaced space changes the structure, and unquoted values can be interpreted unexpectedly (for example, no may become false in older parsers).",
        ],
      },
      {
        heading: "CSV: tables and spreadsheets",
        paragraphs: [
          "CSV stores rows and columns, one record per line, and opens directly in Excel and Google Sheets. It's ideal for flat, tabular data and exports. It can't represent nesting, everything is text, and values containing commas, quotes or line breaks must be quoted correctly — a common source of broken imports.",
        ],
      },
      {
        heading: "Which should you use?",
        paragraphs: [],
        list: [
          "Sending data between programs or calling an API: JSON.",
          "Configuration files that people edit by hand: YAML.",
          "Tabular data for spreadsheets, reports or bulk imports: CSV.",
        ],
      },
      {
        heading: "Converting between them",
        paragraphs: [
          "JSON and YAML convert both ways without loss, apart from YAML comments, which JSON can't hold. CSV converts to JSON as an array of objects keyed by the header row; nested JSON doesn't fit CSV's flat rows. EasyToConvert's data tools run in your browser, so configuration and data containing secrets never leave your device. The CSV to JSON conversion is also available as a REST API for automation.",
        ],
      },
    ],
  },
];

export const blogPostBySlug = (slug: string) => blogPosts.find((p) => p.slug === slug);
