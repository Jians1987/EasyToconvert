import { JavascriptPageClient } from "../javascript/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("minify-js-css-html");

export default function Page() {
  return <ToolLanding slug="minify-js-css-html" Tool={JavascriptPageClient} />;
}
