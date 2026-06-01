interface EmbedVideoPlayerProps {
  title: string;
  url: string;
}

export function EmbedVideoPlayer({ title, url }: EmbedVideoPlayerProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-3xl border border-neutral-800 bg-black shadow-2xl">
      <iframe
        src={url}
        title={title}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  );
}