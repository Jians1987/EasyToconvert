import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("rotate-pdf");

export default function Page() {
  return <ToolLanding slug="rotate-pdf" Tool={PdfPageClient} />;
}
