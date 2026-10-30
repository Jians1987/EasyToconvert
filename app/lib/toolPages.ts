// Copy for the dedicated, indexable tool pages — one per tool. Each page renders the
// existing hub tool locked to `mode` (see components/ToolPageContext.tsx) plus
// server-rendered how-to and FAQ content. Copy must describe only what the
// tool actually does.

import { toolLinks, type ToolLink, type ToolSlug } from "./toolLinks";

interface ToolContent {
  title: string; // <title> (the layout appends " | EasyToConvert")
  description: string; // meta description, ~150 characters
  h1: string;
  intro: string;
  steps: [string, string, string];
  points: string[]; // "Good to know"
  faqs: { q: string; a: string }[];
  related: string[]; // slugs
  appCategory: "UtilitiesApplication" | "MultimediaApplication" | "DeveloperApplication";
  cloud?: boolean; // sends content to a server (opt-in AI)
}

export type ToolPage = ToolLink & ToolContent;

const ON_DEVICE = "Your files are processed in your browser and never uploaded to our servers.";

// Every slug in toolLinks must have content here (enforced by the Record type).
const content: Record<ToolSlug, ToolContent> = {
  // ─── PDF ──────────────────────────────────────────────────────────────────
  "merge-pdf": {
    title: "Merge PDF Files Online – Free, No Upload",
    description: "Combine multiple PDFs into one file in seconds. Free, no sign-up, and your files never leave your device. Optionally add a password to the result.",
    h1: "Merge PDF files into one document",
    intro: "Combine two or more PDFs into a single file, in the order you choose. You can also protect the merged PDF with a password.",
    steps: ["Choose or drop the PDF files you want to combine.", "Check the order — files are merged in the order they are listed.", "Click Process PDF and download the merged document."],
    points: [ON_DEVICE, "Add an optional password to encrypt the merged PDF; a single file works too if you only want to protect it.", "Password-protected source files are detected and you're asked for the password before merging."],
    faqs: [
      { q: "Is there a limit on how many PDFs I can merge?", a: "There is no fixed limit. Because merging happens on your device, the practical limit depends on your browser's memory; dozens of typical documents work fine." },
      { q: "Will merging reduce the quality of my PDF?", a: "No. Pages are copied as they are, so text stays selectable and images keep their original quality." },
      { q: "Can I merge password-protected PDFs?", a: "Yes, if you know the password. Enter it when prompted and the file is unlocked locally before merging." },
    ],
    related: ["split-pdf", "compress-pdf", "rotate-pdf"], appCategory: "UtilitiesApplication",
  },
  "split-pdf": {
    title: "Split PDF – Extract Pages Online Free",
    description: "Extract specific pages or page ranges from a PDF into a new file. Free, private and fast — the PDF is processed in your browser.",
    h1: "Split a PDF and extract the pages you need",
    intro: "Pull out individual pages or ranges such as 1,3,5-10 into a new PDF, without uploading the original anywhere.",
    steps: ["Choose or drop your PDF.", "Type the pages to keep, for example 1,3,5-10.", "Click Process PDF and download the new file."],
    points: [ON_DEVICE, "Use commas for single pages and a hyphen for ranges (5-10).", "Invalid ranges are flagged instead of silently producing the wrong pages."],
    faqs: [
      { q: "How do I extract a single page from a PDF?", a: "Enter just that page number, for example 4, and process the file. The download contains only that page." },
      { q: "Does splitting change the content of the pages?", a: "No. The selected pages are copied unchanged, including text, links and images." },
      { q: "Can I split a scanned PDF?", a: "Yes. Splitting works on any PDF, scanned or digital, because it copies whole pages." },
    ],
    related: ["merge-pdf", "pdf-to-jpg", "rotate-pdf"], appCategory: "UtilitiesApplication",
  },
  "compress-pdf": {
    title: "Compress PDF – Reduce PDF File Size Free",
    description: "Make PDFs smaller for email, uploads and application forms. Choose a compression level and download a lighter PDF. Free, runs in your browser.",
    h1: "Compress a PDF to reduce its file size",
    intro: "Shrink large PDFs — especially scans and image-heavy documents — so they fit email attachments and upload limits.",
    steps: ["Choose or drop the PDF you want to shrink.", "Pick a compression level: Strong, Balanced or Light.", "Click Process PDF, check the new size, and download."],
    points: [ON_DEVICE, "Pages are re-rendered as compressed images. This shrinks scans the most, but text in the result is no longer selectable or searchable.", "If compression wouldn't make your file smaller, you get your original back instead of a bigger one.", "Use Light for documents you will print; Strong for the smallest upload."],
    faqs: [
      { q: "How much smaller will my PDF get?", a: "Scanned and photo-heavy PDFs often shrink by 50–90%. Text-only PDFs are already compact and may not get smaller; in that case the original is kept." },
      { q: "Why can't I select text after compressing?", a: "To reduce size in the browser, each page is turned into a compressed image. Keep the original if you need selectable or searchable text." },
      { q: "How do I get a PDF under a size limit, like 1 MB?", a: "Start with Balanced. If the result is still too large, try Strong, or split the document and compress the parts separately." },
    ],
    related: ["merge-pdf", "compress-image", "pdf-to-jpg"], appCategory: "UtilitiesApplication",
  },
  "pdf-to-word": {
    title: "PDF to Word Converter – Free DOCX Download",
    description: "Convert PDF to an editable Word document (.docx) that keeps headings, paragraphs, bold and italic text, and tables. Free and private.",
    h1: "Convert PDF to an editable Word document",
    intro: "Turn a PDF into a .docx file you can edit in Microsoft Word, Google Docs or LibreOffice, with headings, paragraphs and tables preserved.",
    steps: ["Choose or drop your PDF.", "Keep layout fidelity on to preserve structure; enable Cloud AI OCR only if the PDF is a scan.", "Click Process PDF and download the .docx file."],
    points: [ON_DEVICE + " Optional Cloud AI OCR for scanned pages sends page images to an AI provider only if you turn it on.", "Detects headings, bold and italic text, paragraphs and simple tables.", "Works best with PDFs that contain real text rather than scanned images."],
    faqs: [
      { q: "Can I convert a scanned PDF to Word?", a: "A scan has no text layer, so the on-device converter finds little to extract. Turn on Cloud AI OCR to read scanned pages, or use Image to Text for single pages." },
      { q: "Will the formatting be exactly the same?", a: "Structure such as headings, paragraphs, emphasis and tables is preserved. Complex layouts with columns or floating images may need small touch-ups." },
      { q: "Do I need Microsoft Word?", a: "No. The .docx file opens in Word, Google Docs, LibreOffice and most other editors." },
    ],
    related: ["pdf-to-excel", "image-to-text", "compress-pdf"], appCategory: "UtilitiesApplication",
  },
  "pdf-to-excel": {
    title: "PDF to Excel Converter – Extract Tables Free",
    description: "Extract tables from PDF files into an Excel spreadsheet (.xlsx) with columns and headers detected automatically. Free and runs in your browser.",
    h1: "Convert PDF tables to an Excel spreadsheet",
    intro: "Get tables out of bank statements, invoices and reports and into .xlsx, with rows, columns and header rows detected for you.",
    steps: ["Choose or drop your PDF.", "Leave Cloud AI off for on-device extraction, or enable it for difficult scans.", "Click Process PDF and download the .xlsx file."],
    points: [ON_DEVICE + " Cloud AI is opt-in and sends page images only when enabled.", "Columns are detected from text positions, and column widths and header styling are set automatically.", "Each table is placed on its own worksheet."],
    faqs: [
      { q: "Does it work with bank statements?", a: "Yes. Statements with clearly aligned columns convert well on-device. For scanned statements, enable Cloud AI." },
      { q: "Can I get CSV instead of Excel?", a: "Use the Table Detection tool to export CSV or JSON, or open the .xlsx in Excel or Google Sheets and save it as CSV." },
      { q: "What if columns come out merged or split?", a: "That usually means the PDF's text isn't aligned in a grid. Try Cloud AI, or the Table Detection tool, which finds tables visually." },
    ],
    related: ["pdf-to-word", "csv-to-json", "merge-pdf"], appCategory: "UtilitiesApplication",
  },
  "pdf-to-jpg": {
    title: "PDF to JPG – Convert PDF Pages to Images Free",
    description: "Convert every page of a PDF into a high-quality JPG image you can save and share. Free, no upload — conversion runs in your browser.",
    h1: "Convert PDF pages to JPG images",
    intro: "Render each page of a PDF as a sharp JPG image, ready for slides, social posts or forms that only accept images.",
    steps: ["Choose or drop your PDF.", "Click Process PDF to render every page.", "Download the pages you need as JPG files."],
    points: [ON_DEVICE, "Pages are rendered at 2× resolution with high JPG quality, so text stays crisp.", "Works with scanned and digital PDFs alike."],
    faqs: [
      { q: "Can I convert just one page?", a: "Every page is rendered; simply download the ones you need. To get one page as a PDF instead, use Split PDF." },
      { q: "What resolution are the images?", a: "Pages are rendered at twice their standard size, which is sharp enough for screens and most printing." },
      { q: "Can I get PNG instead of JPG?", a: "Download the JPG, then use the JPG to PNG converter." },
    ],
    related: ["split-pdf", "jpg-to-png", "compress-image"], appCategory: "UtilitiesApplication",
  },
  "rotate-pdf": {
    title: "Rotate PDF Pages Online – Free & Permanent",
    description: "Rotate the pages of a PDF by 90°, 180° or 270° and save the result permanently. Free, private and runs in your browser.",
    h1: "Rotate PDF pages and save the result",
    intro: "Fix sideways or upside-down scans by rotating the pages, then download the corrected PDF.",
    steps: ["Choose or drop your PDF.", "Pick the angle: 90°, 180° or 270° clockwise.", "Click Process PDF and download the rotated file."],
    points: [ON_DEVICE, "Rotation is saved in the file, so it stays fixed in every PDF viewer.", "Page content is not re-compressed, so quality is unchanged."],
    faqs: [
      { q: "Can I rotate only some pages?", a: "This tool rotates every page. To fix just a few, use Split PDF to separate them, rotate that part, then Merge PDF to put the document back together." },
      { q: "Is the rotation permanent?", a: "Yes. The new orientation is written into the PDF, unlike rotating the view in a PDF reader." },
      { q: "What if some pages were already rotated?", a: "The angle is added to each page's current rotation, so every page turns by the same amount." },
    ],
    related: ["merge-pdf", "split-pdf", "add-text-to-pdf"], appCategory: "UtilitiesApplication",
  },
  "add-text-to-pdf": {
    title: "Add Text to PDF Online – Free PDF Text Tool",
    description: "Type text anywhere on a PDF page — fill in forms, add notes or labels — in any colour and size, then download. Free and runs in your browser.",
    h1: "Add text to a PDF",
    intro: "Click anywhere on a page to place text — handy for filling in non-fillable forms, adding notes, dates or labels — then export a new PDF.",
    steps: ["Choose or drop your PDF to open it in the editor.", "Select Text, type what you want to add, pick a colour and size, then click on the page where it should go.", "Click Export & Download to save the new PDF."],
    points: [ON_DEVICE, "Made a mistake? Use Undo to remove the last text you placed, or Clear to start over.", "The text is stamped into the exported PDF, so it shows in every PDF reader."],
    faqs: [
      { q: "Can I change the existing text in a PDF?", a: "This tool adds new text on top of the page. To rewrite existing text, convert the PDF to Word, edit it, and save it as PDF again." },
      { q: "Can I fill in a PDF form that isn't fillable?", a: "Yes. Click on each field and type your answer; the text is placed exactly where you click." },
      { q: "Is the original file changed?", a: "No. You download a new copy with your text added; the original stays on your device untouched." },
    ],
    related: ["pdf-to-word", "merge-pdf", "compress-pdf"], appCategory: "UtilitiesApplication",
  },

  // ─── Image ────────────────────────────────────────────────────────────────
  "compress-image": {
    title: "Compress Image Online – Reduce JPG, PNG, WebP Size",
    description: "Reduce image file size with an adjustable quality slider. Compress JPG, PNG and WebP photos for web, email and forms — free, without uploading.",
    h1: "Compress images without uploading them",
    intro: "Make photos and screenshots smaller for websites, email and online forms. Adjust the quality slider to balance size and sharpness.",
    steps: ["Choose or drop an image.", "Set the compression quality — lower means a smaller file.", "Click the action button and download the compressed image."],
    points: [ON_DEVICE, "Compression re-encodes the image, which also removes embedded metadata such as camera details and GPS location.", "Need an exact size limit like 50 KB? Lower the quality step by step, or reduce the dimensions with Resize Image."],
    faqs: [
      { q: "How do I compress an image to 100 KB or 50 KB?", a: "Lower the quality and check the output size. If it's still too large, reduce the width and height with Resize Image first — fewer pixels shrink the file the most." },
      { q: "Will compression make my photo blurry?", a: "Quality around 70–80% is usually indistinguishable from the original on screens. Very low settings can show blockiness." },
      { q: "Which format gives the smallest files?", a: "WebP is typically 25–35% smaller than JPG at similar quality. Use Image to WebP if the destination accepts it." },
    ],
    related: ["resize-image", "image-to-webp", "compress-pdf"], appCategory: "MultimediaApplication",
  },
  "resize-image": {
    title: "Resize Image Online – Change Width & Height Free",
    description: "Resize photos to exact pixel dimensions, with optional aspect-ratio lock. Free image resizer that works in your browser — no upload.",
    h1: "Resize an image to exact dimensions",
    intro: "Set an exact width and height in pixels — for profile pictures, passport photos, application forms or social media.",
    steps: ["Choose or drop an image.", "Enter the new width or height; keep the aspect ratio locked to avoid stretching.", "Click the action button and download the resized image."],
    points: [ON_DEVICE, "Lock the aspect ratio to change one side and have the other calculated for you.", "Zero or negative sizes are rejected so you never get an empty file."],
    faqs: [
      { q: "How do I resize a photo for an online application form?", a: "Check the form's required pixel size (for example 200 × 230), unlock the aspect ratio if the shape differs, enter both values and download. Then use Compress Image if there's also a KB limit." },
      { q: "Does resizing reduce file size?", a: "Yes. Fewer pixels means a smaller file — usually the most effective way to shrink an image." },
      { q: "Can I enlarge an image?", a: "Yes, but enlarging can't add detail, so the result may look soft." },
    ],
    related: ["compress-image", "jpg-to-png", "png-to-jpg"], appCategory: "MultimediaApplication",
  },
  "png-to-jpg": {
    title: "PNG to JPG Converter – Free, No Upload",
    description: "Convert PNG images to JPG for smaller files and maximum compatibility. Free, fast and private — conversion runs in your browser.",
    h1: "Convert PNG to JPG",
    intro: "Turn PNG screenshots and graphics into JPG files, which are smaller and accepted almost everywhere.",
    steps: ["Choose or drop a PNG image.", "JPG is already selected as the output format.", "Convert and download the JPG."],
    points: [ON_DEVICE, "JPG doesn't support transparency, so transparent areas become a solid background.", "You can also convert WebP and other browser-supported images to JPG."],
    faqs: [
      { q: "Why convert PNG to JPG?", a: "JPG files are usually much smaller for photos and are accepted by nearly every website and form." },
      { q: "What happens to a transparent background?", a: "JPG can't store transparency, so those areas are filled with a solid colour. Keep PNG if you need transparency." },
      { q: "Will I lose quality?", a: "JPG uses lossy compression, but at the default quality the difference is hard to see for photos." },
    ],
    related: ["jpg-to-png", "compress-image", "image-to-webp"], appCategory: "MultimediaApplication",
  },
  "jpg-to-png": {
    title: "JPG to PNG Converter – Free, No Upload",
    description: "Convert JPG photos to lossless PNG images in your browser. Free, private and instant, with no sign-up and no file uploads.",
    h1: "Convert JPG to PNG",
    intro: "Save a JPG as a lossless PNG — useful when a site requires PNG or you plan to edit the image further.",
    steps: ["Choose or drop a JPG image.", "PNG is already selected as the output format.", "Convert and download the PNG."],
    points: [ON_DEVICE, "PNG is lossless, so further edits won't add compression artefacts.", "PNG files are larger than JPG for photos."],
    faqs: [
      { q: "Does converting JPG to PNG improve quality?", a: "No. It preserves the image exactly as it is now, but can't restore detail already lost to JPG compression." },
      { q: "Will the PNG have a transparent background?", a: "No. A JPG has no transparency, so the PNG keeps the same opaque background." },
      { q: "Why is the PNG bigger?", a: "PNG stores every pixel without lossy compression, so photos take more space than in JPG." },
    ],
    related: ["png-to-jpg", "svg-to-png", "resize-image"], appCategory: "MultimediaApplication",
  },
  "image-to-webp": {
    title: "Convert Images to WebP – JPG & PNG to WebP Free",
    description: "Convert JPG and PNG images to WebP for faster websites and smaller files. Free WebP converter that runs entirely in your browser.",
    h1: "Convert JPG and PNG images to WebP",
    intro: "WebP images are typically 25–35% smaller than JPG at similar quality, which makes pages load faster.",
    steps: ["Choose or drop a JPG or PNG image.", "WebP is already selected as the output format.", "Convert and download the WebP file."],
    points: [ON_DEVICE, "All modern browsers display WebP.", "Re-encoding strips embedded metadata such as GPS location."],
    faqs: [
      { q: "Is WebP better than JPG?", a: "For the web, usually yes: smaller files at the same visual quality, plus transparency support." },
      { q: "Do all browsers support WebP?", a: "Yes, every current version of Chrome, Safari, Firefox and Edge supports WebP." },
      { q: "Can I convert WebP back to JPG?", a: "Yes — use PNG to JPG; it accepts WebP input too." },
    ],
    related: ["compress-image", "png-to-jpg", "resize-image"], appCategory: "MultimediaApplication",
  },
  "svg-to-png": {
    title: "SVG to PNG Converter – Free, No Upload",
    description: "Convert SVG vector graphics to PNG images for apps, documents and sites that don't accept SVG. Free and private, in your browser.",
    h1: "Convert SVG to PNG",
    intro: "Rasterise an SVG logo or icon into a PNG that works in documents, slides and upload forms.",
    steps: ["Choose or drop an SVG file.", "PNG is already selected as the output format.", "Convert and download the PNG."],
    points: [ON_DEVICE, "Transparent backgrounds in the SVG are preserved in the PNG.", "Use Resize Image afterwards if you need specific dimensions."],
    faqs: [
      { q: "Why convert SVG to PNG?", a: "Many apps, social networks and forms don't accept SVG files, but every one accepts PNG." },
      { q: "Is transparency kept?", a: "Yes. PNG supports transparency, so transparent areas stay transparent." },
      { q: "Can I convert PNG back to SVG?", a: "Not with this tool: turning pixels into vectors requires tracing, which this converter doesn't do." },
    ],
    related: ["jpg-to-png", "resize-image", "image-to-webp"], appCategory: "MultimediaApplication",
  },

  // ─── Data ─────────────────────────────────────────────────────────────────
  "json-formatter": {
    title: "JSON Formatter & Validator – Beautify or Minify JSON",
    description: "Format, validate and minify JSON instantly. Paste JSON to pretty-print it with indentation or compress it. Free and private — nothing is uploaded.",
    h1: "Format, validate and minify JSON",
    intro: "Paste JSON to pretty-print it with clear indentation, check that it's valid, or minify it to a single compact line.",
    steps: ["Paste your JSON into the input box.", "Click Beautify to format it, or Minify to compress it.", "Copy the result or download it."],
    points: ["Your data is processed in your browser and never uploaded.", "Invalid JSON shows a clear error instead of a wrong result.", "Drop a .json file on the home page to open it here directly."],
    faqs: [
      { q: "How do I check if my JSON is valid?", a: "Paste it and click Beautify. Valid JSON is formatted; invalid JSON shows an error explaining what's wrong." },
      { q: "Is it safe to paste API responses or config files?", a: "Yes. Formatting runs entirely in your browser, so the data never reaches our servers." },
      { q: "What does minifying JSON do?", a: "It removes all unnecessary spaces and line breaks, producing the smallest equivalent JSON." },
    ],
    related: ["csv-to-json", "json-to-yaml", "xml-to-json"], appCategory: "DeveloperApplication",
  },
  "csv-to-json": {
    title: "CSV to JSON Converter – and JSON to CSV, Free",
    description: "Convert CSV to JSON and JSON back to CSV. Handles quoted fields with commas and line breaks. Free, private and runs in your browser.",
    h1: "Convert CSV to JSON (and JSON to CSV)",
    intro: "Turn spreadsheet exports into JSON arrays using the header row as keys — or convert a JSON array back into CSV.",
    steps: ["Paste CSV with a header row, or a JSON array of objects.", "Click convert — the direction is detected automatically.", "Copy or download the result."],
    points: ["Your data is processed in your browser and never uploaded.", "Quoted fields can contain commas, quotes and line breaks.", "Also available as a REST API for automated pipelines."],
    faqs: [
      { q: "Does the first row have to be headers?", a: "Yes. The first row supplies the keys for each JSON object." },
      { q: "How do I convert an Excel file to JSON?", a: "In Excel or Google Sheets, save or download the sheet as CSV, then paste it here." },
      { q: "Can I automate this?", a: "Yes. The EasyToConvert API has a csv-to-json endpoint; see the API documentation." },
    ],
    related: ["json-formatter", "pdf-to-excel", "json-to-yaml"], appCategory: "DeveloperApplication",
  },
  "xml-to-json": {
    title: "XML to JSON Converter – Free Online",
    description: "Convert XML documents to JSON instantly. Elements become keys and repeated elements become arrays. Free, private and in your browser.",
    h1: "Convert XML to JSON",
    intro: "Paste XML from feeds, legacy APIs or config files and get clean JSON you can use in JavaScript and modern APIs.",
    steps: ["Paste your XML into the input box.", "Click convert.", "Copy or download the JSON."],
    points: ["Your data is processed in your browser and never uploaded.", "Malformed XML is reported as an error instead of producing broken JSON."],
    faqs: [
      { q: "Can I convert JSON to XML?", a: "This tool converts XML to JSON only." },
      { q: "What happens to repeated elements?", a: "Elements that repeat under the same parent are grouped into a JSON array." },
      { q: "Is my XML uploaded?", a: "No. Parsing happens in your browser." },
    ],
    related: ["json-formatter", "json-to-yaml", "csv-to-json"], appCategory: "DeveloperApplication",
  },
  "json-to-yaml": {
    title: "JSON to YAML Converter – and YAML to JSON",
    description: "Convert JSON to YAML and YAML to JSON for Kubernetes, Docker Compose and CI config files. Free, private and runs in your browser.",
    h1: "Convert JSON to YAML (and YAML to JSON)",
    intro: "Switch configuration between JSON and YAML — handy for Kubernetes manifests, Docker Compose files and CI pipelines.",
    steps: ["Paste JSON or YAML into the input box.", "Click the conversion you need.", "Copy or download the result."],
    points: ["Your data is processed in your browser and never uploaded.", "Invalid input shows a clear error message."],
    faqs: [
      { q: "Is YAML a superset of JSON?", a: "Essentially yes — valid JSON is also valid YAML — but YAML's indentation-based style is easier to read and edit by hand." },
      { q: "Are comments preserved?", a: "No. JSON has no comments, so YAML comments are dropped when converting to JSON." },
      { q: "Is it safe for config files containing secrets?", a: "Conversion runs entirely in your browser, so nothing is sent to a server." },
    ],
    related: ["json-formatter", "xml-to-json", "csv-to-json"], appCategory: "DeveloperApplication",
  },

  // ─── Developer ────────────────────────────────────────────────────────────
  "base64-encode-decode": {
    title: "Base64 Encode & Decode Online – Free",
    description: "Encode text to Base64 or decode Base64 back to text, with full Unicode support. Free, instant and private — runs in your browser.",
    h1: "Base64 encoder and decoder",
    intro: "Encode text to Base64 or decode Base64 strings back to readable text. Emoji and non-Latin scripts are handled correctly.",
    steps: ["Paste the text or Base64 string.", "Click Encode or Decode.", "Copy the result."],
    points: ["Everything runs in your browser — nothing is sent to a server.", "Unicode-safe: works with emoji, Hindi, Chinese and other scripts.", "Invalid Base64 input shows an error instead of garbage output."],
    faqs: [
      { q: "Is Base64 encryption?", a: "No. Base64 is an encoding that anyone can reverse. Never use it to protect secrets." },
      { q: "Why does Base64 output end with = signs?", a: "They're padding that makes the output length a multiple of four characters." },
      { q: "Can I decode a Base64 image?", a: "This tool decodes Base64 to text. Image data decodes to binary and won't display as readable text." },
    ],
    related: ["url-encode-decode", "uuid-generator", "json-formatter"], appCategory: "DeveloperApplication",
  },
  "url-encode-decode": {
    title: "URL Encode & Decode Online – Percent-Encoding Tool",
    description: "Percent-encode text for safe use in URLs and query strings, or decode encoded URLs back to readable text. Free and in your browser.",
    h1: "URL encoder and decoder",
    intro: "Encode spaces and special characters as %20-style escapes for query strings, or decode a URL to read it.",
    steps: ["Paste the text or URL.", "Click Encode or Decode.", "Copy the result."],
    points: ["Everything runs in your browser — nothing is sent to a server.", "Uses standard percent-encoding, so the output works in any URL."],
    faqs: [
      { q: "When do I need to URL-encode?", a: "Whenever a value in a query string contains spaces, &, =, ?, # or non-ASCII characters." },
      { q: "Why does a space become %20?", a: "Spaces aren't allowed in URLs, so they're replaced by their hexadecimal code, 20." },
      { q: "Is URL encoding the same as Base64?", a: "No. URL encoding escapes only unsafe characters; Base64 re-encodes all of the data." },
    ],
    related: ["base64-encode-decode", "qr-code-generator", "json-formatter"], appCategory: "DeveloperApplication",
  },
  "uuid-generator": {
    title: "UUID Generator – Random v4 UUIDs Online",
    description: "Generate random, RFC 4122 version 4 UUIDs (GUIDs) instantly, in bulk. Free UUID generator using your browser's secure random source.",
    h1: "Generate random v4 UUIDs",
    intro: "Create standards-compliant version 4 UUIDs for database keys, test data and identifiers — several at a time.",
    steps: ["Open the UUID generator.", "Click Generate to create a batch of UUIDs.", "Copy the ones you need."],
    points: ["UUIDs are generated in your browser with a cryptographically secure random source.", "Every UUID follows the RFC 4122 version 4 format."],
    faqs: [
      { q: "Is a GUID the same as a UUID?", a: "Yes. GUID is Microsoft's name for the same 128-bit identifier format." },
      { q: "Can two v4 UUIDs collide?", a: "In practice, no. There are 2¹²² possible values, so a collision is astronomically unlikely." },
      { q: "Should I use UUIDs as passwords?", a: "No. Use the Password Generator for secrets." },
    ],
    related: ["password-generator", "base64-encode-decode", "json-formatter"], appCategory: "DeveloperApplication",
  },
  "password-generator": {
    title: "Strong Password Generator – Random & Secure",
    description: "Generate strong, random passwords with your chosen length and character types. Created in your browser and never sent anywhere.",
    h1: "Generate a strong random password",
    intro: "Create long, random passwords that are hard to guess, with the length and character types you choose.",
    steps: ["Choose a length — 16 or more characters is recommended.", "Click Generate Password.", "Copy it straight into your password manager."],
    points: ["Passwords are created in your browser using a cryptographically secure random source and never transmitted.", "Use a unique password for every account."],
    faqs: [
      { q: "How long should a password be?", a: "At least 12 characters; 16 or more is better. Length matters more than complexity." },
      { q: "Is it safe to generate passwords online?", a: "This generator runs entirely in your browser — the password never leaves your device." },
      { q: "How do I remember random passwords?", a: "Use a password manager, which stores them securely and fills them in for you." },
    ],
    related: ["uuid-generator", "qr-code-generator", "base64-encode-decode"], appCategory: "DeveloperApplication",
  },
  "qr-code-generator": {
    title: "Free QR Code Generator – Links, Text & Wi-Fi",
    description: "Create QR codes for links, text and more, then download them as images. Free, no sign-up, no tracking and no expiry.",
    h1: "Create a free QR code",
    intro: "Turn a link or any text into a QR code you can download and print on flyers, menus, cards and posters.",
    steps: ["Type or paste a link or text.", "The QR code is generated instantly.", "Download or copy the QR code image."],
    points: ["QR codes are generated in your browser — no sign-up and no tracking redirects.", "Codes contain your content directly, so they never expire."],
    faqs: [
      { q: "Do these QR codes expire?", a: "No. The content is encoded directly in the code, with no redirect service in between." },
      { q: "Can I make a QR code for Wi-Fi?", a: "Yes. Enter text in the form WIFI:T:WPA;S:NetworkName;P:Password;; and most phones will offer to join the network." },
      { q: "How big should I print a QR code?", a: "At least 2 × 2 cm for close scanning; larger if people will scan from a distance." },
    ],
    related: ["url-encode-decode", "password-generator", "uuid-generator"], appCategory: "DeveloperApplication",
  },

  // ─── JavaScript & CSS ─────────────────────────────────────────────────────
  "minify-js-css-html": {
    title: "Minify JavaScript, CSS & HTML Online – Free",
    description: "Minify JavaScript, CSS and HTML to shrink file size and speed up your site. Removes comments and whitespace safely, in your browser.",
    h1: "Minify JavaScript, CSS and HTML",
    intro: "Strip comments and unnecessary whitespace from your code to make it smaller and faster to download.",
    steps: ["Choose JavaScript, CSS or HTML.", "Paste your code.", "Click the minify button and copy the result."],
    points: ["Code is processed in your browser and never uploaded.", "Comments are removed without corrupting strings or operators."],
    faqs: [
      { q: "Will minification break my code?", a: "It only removes comments and whitespace. Always test minified code before deploying." },
      { q: "How much smaller will my files get?", a: "Typically 20–40%, depending on how many comments and how much indentation the code has." },
      { q: "Does it rename variables?", a: "No. It's a whitespace and comment minifier, not a full optimiser like Terser." },
    ],
    related: ["html-formatter", "css-gradient-generator", "json-formatter"], appCategory: "DeveloperApplication",
  },
  "html-formatter": {
    title: "HTML Formatter & Beautifier – Indent HTML Online",
    description: "Beautify messy or minified HTML with clean, consistent indentation so it's easy to read and edit. Free and private.",
    h1: "Format and beautify HTML",
    intro: "Paste minified or messy HTML and get neatly indented markup that's easy to read, review and edit.",
    steps: ["Paste your HTML.", "Click Beautify HTML Code.", "Copy the formatted markup."],
    points: ["Code is processed in your browser and never uploaded.", "Nested tags are indented consistently."],
    faqs: [
      { q: "Does formatting change how the page looks?", a: "No. Only whitespace between tags changes; the content and structure stay the same." },
      { q: "Can it fix broken HTML?", a: "It indents what's there but doesn't repair missing or mismatched tags." },
      { q: "Can I minify HTML too?", a: "Yes — use the JS / CSS / HTML Minifier." },
    ],
    related: ["minify-js-css-html", "json-formatter", "box-shadow-generator"], appCategory: "DeveloperApplication",
  },
  "css-gradient-generator": {
    title: "CSS Gradient Generator – Copy-Ready CSS",
    description: "Design linear CSS gradients visually, preview them live and copy the CSS code. Free gradient generator for web designers and developers.",
    h1: "CSS gradient generator",
    intro: "Pick colours and an angle, preview the gradient live, and copy production-ready CSS.",
    steps: ["Choose your colours.", "Adjust the angle until the preview looks right.", "Copy the generated CSS."],
    points: ["Runs in your browser.", "Outputs standard CSS that works in all modern browsers."],
    faqs: [
      { q: "Do CSS gradients need vendor prefixes?", a: "No. Every current browser supports the standard linear-gradient() syntax." },
      { q: "Are gradients better than background images?", a: "They're resolution-independent and add no file download, so they're often faster." },
      { q: "Can I use the gradient for text?", a: "Yes: apply it as a background, then add background-clip: text and a transparent text colour." },
    ],
    related: ["box-shadow-generator", "minify-js-css-html", "html-formatter"], appCategory: "DeveloperApplication",
  },
  "box-shadow-generator": {
    title: "CSS Box Shadow Generator – Preview & Copy",
    description: "Create CSS box-shadow effects with live preview — adjust offset, blur, spread and colour, then copy the CSS. Free and in your browser.",
    h1: "CSS box-shadow generator",
    intro: "Tune offset, blur, spread and colour with a live preview, then copy the box-shadow CSS.",
    steps: ["Adjust the offset, blur and spread.", "Pick a shadow colour.", "Copy the generated CSS."],
    points: ["Runs in your browser.", "Outputs standard box-shadow CSS."],
    faqs: [
      { q: "What's the difference between blur and spread?", a: "Blur softens the shadow's edge; spread grows or shrinks the shadow before blurring." },
      { q: "How do I make a subtle shadow?", a: "Use a small vertical offset, a larger blur and a low-opacity colour, such as rgba(0,0,0,0.1)." },
      { q: "Does box-shadow slow pages down?", a: "Not noticeably for normal use; very large blurred shadows on many elements can affect scrolling on slow devices." },
    ],
    related: ["css-gradient-generator", "minify-js-css-html", "html-formatter"], appCategory: "DeveloperApplication",
  },

  // ─── AI ───────────────────────────────────────────────────────────────────
  "image-to-text": {
    title: "Image to Text – Free OCR, Extract Text from Images",
    description: "Extract text from photos, screenshots and scanned images with free on-device OCR. Copy the text instantly — your image is never uploaded.",
    h1: "Extract text from an image (OCR)",
    intro: "Turn screenshots, photos of documents and scans into editable text you can copy, search and paste.",
    steps: ["Choose or drop an image.", "Wait a few seconds while the text is recognised on your device.", "Copy the extracted text."],
    points: ["On-device OCR: your image is never uploaded. Optional Cloud AI OCR is available for difficult images and sends the image only if you turn it on.", "Shows a confidence score so you know how reliable the result is.", "Works best with clear, well-lit, horizontal text."],
    faqs: [
      { q: "Which languages are supported?", a: "The on-device engine reads English. Cloud AI OCR can handle more complex documents." },
      { q: "Can I extract text from a scanned PDF?", a: "Yes — use the PDF Summarizer, which runs OCR on scanned pages, or convert pages with PDF to JPG first." },
      { q: "How can I get better results?", a: "Use a sharp, straight, high-contrast image. Crop away anything that isn't text." },
    ],
    related: ["pdf-to-word", "pdf-to-jpg", "summarize-pdf"], appCategory: "UtilitiesApplication",
  },
  "summarize-pdf": {
    title: "AI PDF Summarizer – Summarize Documents Free",
    description: "Get the key points of a long PDF in seconds with AI. Text is extracted on your device and only the text is sent to the AI to summarise.",
    h1: "Summarize a PDF with AI",
    intro: "Get the main points, takeaways and a short summary of reports, papers and long documents.",
    steps: ["Choose or drop a PDF.", "Click Run AI summarize.", "Read or copy the summary."],
    points: ["Text is extracted on your device; only the extracted text is sent to the AI provider to generate the summary.", "Scanned pages are read with OCR first.", "Don't use it for confidential documents you can't share with a third-party AI service."],
    faqs: [
      { q: "Is my PDF uploaded?", a: "The file itself isn't. Its text is extracted in your browser, and only that text is sent to the AI service to be summarised." },
      { q: "How long can the document be?", a: "Very long documents are trimmed to fit the AI model's limit, so the summary focuses on the first part. Split long files into sections for full coverage." },
      { q: "Does it work on scanned PDFs?", a: "Yes. Scanned pages are run through OCR before summarising." },
    ],
    related: ["image-to-text", "pdf-to-word", "split-pdf"], appCategory: "UtilitiesApplication", cloud: true,
  },

  // ─── Media ────────────────────────────────────────────────────────────────
  "compress-audio": {
    title: "Compress Audio Online – Reduce MP3 & WAV Size",
    description: "Shrink audio files by converting to MP3 at the bitrate you choose. Free audio compressor powered by FFmpeg, running in your browser.",
    h1: "Compress audio files to MP3",
    intro: "Reduce the size of voice notes, recordings and music by re-encoding them as MP3 at a lower bitrate.",
    steps: ["Choose or drop an audio file.", "Pick a bitrate — 128 kbps suits music, 64 kbps is fine for speech.", "Convert and download the compressed file."],
    points: [ON_DEVICE, "Powered by FFmpeg compiled to WebAssembly; the engine downloads once on first use.", "Output can be MP3 (compressed) or WAV (uncompressed)."],
    faqs: [
      { q: "What bitrate should I use?", a: "128 kbps is a good default for music; 64–96 kbps is plenty for speech and podcasts." },
      { q: "Can I compress a WAV file?", a: "Yes. Converting WAV to MP3 usually reduces the size by around 90%." },
      { q: "Does it compress video?", a: "No — this tool outputs audio only. To get the soundtrack from a video, use Video to MP3." },
    ],
    related: ["video-to-mp3", "trim-audio", "compress-image"], appCategory: "MultimediaApplication",
  },
  "video-to-mp3": {
    title: "Video to MP3 – Extract Audio from MP4 Free",
    description: "Extract the audio track from MP4, MOV and WebM videos and save it as MP3. Free, private and runs in your browser with FFmpeg.",
    h1: "Extract audio from a video as MP3",
    intro: "Save the soundtrack, speech or music from a video file as an MP3 you can play anywhere.",
    steps: ["Choose or drop a video file.", "Pick the MP3 bitrate.", "Convert and download the MP3."],
    points: [ON_DEVICE + " Your video is never uploaded.", "Supports common formats such as MP4, MOV and WebM.", "Powered by FFmpeg compiled to WebAssembly."],
    faqs: [
      { q: "Can I convert a YouTube link?", a: "No. This tool works with video files on your device; it doesn't download from websites." },
      { q: "How long does conversion take?", a: "Usually a few seconds to a minute, depending on the video's length and your device." },
      { q: "Is there a file size limit?", a: "There's no fixed limit, but very large videos need plenty of free memory in your browser." },
    ],
    related: ["compress-audio", "trim-audio", "image-to-text"], appCategory: "MultimediaApplication",
  },
  "trim-audio": {
    title: "Trim Audio Online – Cut MP3 Free",
    description: "Cut a section out of an audio file by start and end time and save it as MP3 — for ringtones, clips and podcasts. Free and in your browser.",
    h1: "Trim audio and cut MP3 clips",
    intro: "Keep just the part you need from a recording or song — perfect for ringtones, clips and voice notes.",
    steps: ["Choose or drop an audio file.", "Enter the start and end time in seconds.", "Cut and download the clip as MP3."],
    points: [ON_DEVICE, "The end time must be after the start time; you'll get a clear message if it isn't.", "Powered by FFmpeg compiled to WebAssembly."],
    faqs: [
      { q: "How do I make a ringtone?", a: "Trim a 20–30 second section and download the MP3. Android uses MP3 directly; iPhones need the clip converted to M4R." },
      { q: "Can I trim a video's audio?", a: "Extract the audio first with Video to MP3, then trim it here." },
      { q: "Is quality reduced?", a: "The clip is encoded at 192 kbps MP3, which sounds transparent for most listeners." },
    ],
    related: ["compress-audio", "video-to-mp3", "compress-image"], appCategory: "MultimediaApplication",
  },
};

export const toolPages: ToolPage[] = toolLinks.map((link) => ({ ...link, ...content[link.slug] }));
export const toolPageBySlug = (slug: string) => toolPages.find((t) => t.slug === slug);
