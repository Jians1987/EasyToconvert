import { DeveloperPageClient } from "../developer/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("url-encode-decode");

export default function Page() {
  return <ToolLanding slug="url-encode-decode" Tool={DeveloperPageClient} />;
}
