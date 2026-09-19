import { ImageOff } from "lucide-react";
import { useState } from "react";

import { getImageContentUrl, type ImageOrigin } from "../services/imageApi";

interface ImagePreviewProps {
  sourceId: number;
  origin: ImageOrigin;
  url: string | null;
  alt: string;
  className?: string;
}

export function ImagePreview({
  sourceId,
  origin,
  url,
  alt,
  className = "h-full w-full object-contain",
}: ImagePreviewProps) {
  const sourceUrl = origin === "UPLOAD" ? getImageContentUrl(sourceId) : url;
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const failed = failedSource === sourceUrl;

  if (!sourceUrl || failed) {
    const hasAccessibleAlt = alt.trim().length > 0;

    return (
      <div
        role={hasAccessibleAlt ? "img" : undefined}
        aria-label={hasAccessibleAlt ? `${alt} unavailable` : undefined}
        aria-hidden={hasAccessibleAlt ? undefined : true}
        className="flex h-full min-h-32 w-full items-center justify-center bg-(--surface) p-5 text-(--text-muted)"
      >
        <div className="text-center">
          <ImageOff size={28} className="mx-auto" aria-hidden="true" />
          <p className="mt-2 text-xs">Image unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={sourceUrl}
      alt={alt}
      className={className}
      onError={() => setFailedSource(sourceUrl)}
    />
  );
}
