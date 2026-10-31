import { PdfPageClient } from "../pdf/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("pdf-to-jpg");

export default function Page() {
  return <ToolLanding slug="pdf-to-jpg" Tool={PdfPageClient} />;
}
