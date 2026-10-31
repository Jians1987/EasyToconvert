import { DeveloperPageClient } from "../developer/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("password-generator");

export default function Page() {
  return <ToolLanding slug="password-generator" Tool={DeveloperPageClient} />;
}
