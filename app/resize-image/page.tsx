import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("resize-image");

export default function Page() {
  return <ToolLanding slug="resize-image" Tool={ImagePageClient} />;
}
