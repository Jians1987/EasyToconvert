import { MediaPageClient } from "../media/PageClient";
import { ToolLanding, toolMetadata } from "@/components/ToolLanding";

export const metadata = toolMetadata("video-to-mp3");

export default function Page() {
  return <ToolLanding slug="video-to-mp3" Tool={MediaPageClient} />;
}
