import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("jpg-to-png");

export default function Page() {
  return <ToolLanding slug="jpg-to-png" Tool={ImagePageClient} />;
}
