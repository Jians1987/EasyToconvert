import { JavascriptPageClient } from "../javascript/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("html-formatter");

export default function Page() {
  return <ToolLanding slug="html-formatter" Tool={JavascriptPageClient} />;
}
