import { MediaPageClient } from "../media/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("trim-audio");

export default function Page() {
  return <ToolLanding slug="trim-audio" Tool={MediaPageClient} />;
}
