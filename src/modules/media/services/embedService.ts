export function normalizeEmbedUrl(inputUrl: string): string {
  const url = inputUrl.trim();

  if (!url) {
    return "";
  }

  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.hostname.includes("youtube.com") &&
      parsedUrl.pathname === "/watch"
    ) {
      const videoId = parsedUrl.searchParams.get("v");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    if (parsedUrl.hostname === "youtu.be") {
      const videoId = parsedUrl.pathname.replace("/", "");

      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }

    return url;
  } catch {
    return url;
  }
}