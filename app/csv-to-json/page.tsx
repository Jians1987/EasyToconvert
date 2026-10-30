import { DataPageClient } from "../data/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("csv-to-json");

export default function Page() {
  return <ToolLanding slug="csv-to-json" Tool={DataPageClient} />;
}
