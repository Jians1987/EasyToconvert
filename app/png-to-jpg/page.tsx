import { ImagePageClient } from "../image/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("png-to-jpg");

export default function Page() {
  return <ToolLanding slug="png-to-jpg" Tool={ImagePageClient} />;
}
