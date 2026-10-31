import { DeveloperPageClient } from "../developer/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("base64-encode-decode");

export default function Page() {
  return <ToolLanding slug="base64-encode-decode" Tool={DeveloperPageClient} />;
}
