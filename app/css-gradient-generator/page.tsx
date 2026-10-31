import { JavascriptPageClient } from "../javascript/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("css-gradient-generator");

export default function Page() {
  return <ToolLanding slug="css-gradient-generator" Tool={JavascriptPageClient} />;
}
