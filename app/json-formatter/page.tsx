import { DataPageClient } from "../data/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("json-formatter");

export default function Page() {
  return <ToolLanding slug="json-formatter" Tool={DataPageClient} />;
}
