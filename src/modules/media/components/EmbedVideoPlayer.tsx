import ReactPlayer from "react-player";

interface EmbedVideoPlayerProps {
  title: string;
  url: string;
  playerRef: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate: (timestamp: number) => void;
}

export function EmbedVideoPlayer({
  title,
  url,
  playerRef,
  onTimeUpdate,
}: EmbedVideoPlayerProps) {
  return (
    <div className="aspect-video w-full max-h-[68vh] overflow-hidden rounded-3xl border border-neutral-800 bg-black shadow-2xl">
      <ReactPlayer
        ref={playerRef}
        src={url}
        title={title}
        controls
        width="100%"
        height="100%"
        onTimeUpdate={(event) => {
          const currentTime = event.currentTarget.currentTime;

          if (Number.isNaN(currentTime)) return;

          onTimeUpdate(currentTime);
        }}
      />
    </div>
  );
}
