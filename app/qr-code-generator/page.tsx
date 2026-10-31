import { DeveloperPageClient } from "../developer/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("qr-code-generator");

export default function Page() {
  return <ToolLanding slug="qr-code-generator" Tool={DeveloperPageClient} />;
}
