import {
  Clapperboard,
  GalleryHorizontalEnd,
  Image,
  CircleDashed,
  MonitorPlay,
  MessageSquareText,
  Lightbulb,
} from "lucide-react";
import type { ComponentType } from "react";

const ICONS: Record<string, ComponentType<{ className?: string }>> = {
  reel: Clapperboard,
  carrusel: GalleryHorizontalEnd,
  post: Image,
  historia: CircleDashed,
  video: MonitorPlay,
  texto: MessageSquareText,
};

// The icon for a piece's format; a lightbulb while it has none yet
export default function FormatIcon({
  format,
  className = "w-3.5 h-3.5",
}: {
  format: string;
  className?: string;
}) {
  const Icon = ICONS[format] ?? Lightbulb;
  return <Icon className={className} />;
}
