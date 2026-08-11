export function formatTime(totalSeconds?: number) {
  const secondsValue = Math.max(0, Math.floor(totalSeconds ?? 0));

  const minutes = Math.floor(secondsValue / 60);
  const seconds = secondsValue % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function parseTimeToSeconds(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return 0;
  }

  const parts = trimmedValue.split(":").map((part) => part.trim());

  if (parts.length === 1) {
    const seconds = Number(parts[0]);

    if (Number.isNaN(seconds)) {
      return 0;
    }

    return Math.max(0, Math.floor(seconds));
  }

  if (parts.length === 2) {
    const minutes = Number(parts[0]);
    const seconds = Number(parts[1]);

    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
      return 0;
    }

    return Math.max(0, Math.floor(minutes * 60 + seconds));
  }

  return 0;
}