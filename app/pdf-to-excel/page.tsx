import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("pdf-to-excel");

export default function Page() {
  return <ToolLanding slug="pdf-to-excel" Tool={PdfPageClient} />;
}
