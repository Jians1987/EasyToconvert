import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("image-to-webp");

export default function Page() {
  return <ToolLanding slug="image-to-webp" Tool={ImagePageClient} />;
}
