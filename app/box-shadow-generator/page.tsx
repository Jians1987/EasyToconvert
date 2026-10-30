import { JavascriptPageClient } from "../javascript/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("box-shadow-generator");

export default function Page() {
  return <ToolLanding slug="box-shadow-generator" Tool={JavascriptPageClient} />;
}
