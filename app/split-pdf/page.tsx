import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("split-pdf");

export default function Page() {
  return <ToolLanding slug="split-pdf" Tool={PdfPageClient} />;
}
