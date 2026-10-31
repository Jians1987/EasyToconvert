import { AiPageClient } from "../ai/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("image-to-text");

export default function Page() {
  return <ToolLanding slug="image-to-text" Tool={AiPageClient} />;
}
