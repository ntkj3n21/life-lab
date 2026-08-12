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

  const minutes =
    Math.floor(
      secondsValue / 60,
    );

  const seconds =
    secondsValue % 60;

  return `${minutes}:${seconds
    .toString()
    .padStart(2, "0")}`;
}