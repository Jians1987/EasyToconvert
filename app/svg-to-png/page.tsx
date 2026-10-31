import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("svg-to-png");

export default function Page() {
  return <ToolLanding slug="svg-to-png" Tool={ImagePageClient} />;
}
