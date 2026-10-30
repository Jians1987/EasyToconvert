import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("compress-pdf");

export default function Page() {
  return <ToolLanding slug="compress-pdf" Tool={PdfPageClient} />;
}
