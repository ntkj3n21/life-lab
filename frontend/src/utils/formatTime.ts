export function formatTime(
  totalSeconds?: number,
) {
  const secondsValue =
    Math.max(
      0,
      Math.floor(
        totalSeconds ?? 0,
      ),
    );

  const hours =
    Math.floor(
      secondsValue / 3600,
    );

  const minutes =
    Math.floor(
      (secondsValue % 3600) / 60,
    );

  const seconds =
    secondsValue % 60;

  const formattedMinutes =
    minutes.toString().padStart(2, "0");
  const formattedSeconds =
    seconds.toString().padStart(2, "0");

  return hours > 0
    ? `${hours}:${formattedMinutes}:${formattedSeconds}`
    : `${minutes}:${formattedSeconds}`;
}
