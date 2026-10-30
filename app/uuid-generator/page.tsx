import { DeveloperPageClient } from "../developer/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("uuid-generator");

export default function Page() {
  return <ToolLanding slug="uuid-generator" Tool={DeveloperPageClient} />;
}
