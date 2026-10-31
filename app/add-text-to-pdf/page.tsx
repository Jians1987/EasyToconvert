import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("add-text-to-pdf");

export default function Page() {
  return <ToolLanding slug="add-text-to-pdf" Tool={PdfPageClient} />;
}
