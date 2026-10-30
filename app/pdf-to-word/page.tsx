import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("pdf-to-word");

export default function Page() {
  return <ToolLanding slug="pdf-to-word" Tool={PdfPageClient} />;
}
