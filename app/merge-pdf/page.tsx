import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("merge-pdf");

export default function Page() {
  return <ToolLanding slug="merge-pdf" Tool={PdfPageClient} />;
}
