import { AiPageClient } from "../ai/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("summarize-pdf");

export default function Page() {
  return <ToolLanding slug="summarize-pdf" Tool={AiPageClient} />;
}
