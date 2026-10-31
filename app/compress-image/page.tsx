import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("compress-image");

export default function Page() {
  return <ToolLanding slug="compress-image" Tool={ImagePageClient} />;
}
