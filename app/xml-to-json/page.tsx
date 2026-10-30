import { DataPageClient } from "../data/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("xml-to-json");

export default function Page() {
  return <ToolLanding slug="xml-to-json" Tool={DataPageClient} />;
}
