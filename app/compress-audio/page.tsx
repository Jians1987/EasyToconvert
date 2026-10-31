import { MediaPageClient } from "../media/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("compress-audio");

export default function Page() {
  return <ToolLanding slug="compress-audio" Tool={MediaPageClient} />;
}
