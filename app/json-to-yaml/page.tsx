import { DataPageClient } from "../data/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("json-to-yaml");

export default function Page() {
  return <ToolLanding slug="json-to-yaml" Tool={DataPageClient} />;
}
