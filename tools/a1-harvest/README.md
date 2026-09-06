# A1 subtitle harvest

This directory contains explicit development tooling for auditing subtitle
coverage across the locked A1 source set. It does not run during application
startup and does not modify A1 seed data.

The source of truth is `../a1/a1-source-snapshot.json`. The input builder
requires exactly 37 unique sources:

- 36 `CURRENT_LIBRARY` sources;
- 1 `HISTORICAL_H1` source;
- `H1_GIT_TEAMWORK` must resolve to `-XsRLyKV9_k`.

## Requirements

- PowerShell 7 (Windows PowerShell 5.1 is also supported by the scripts);
- `yt-dlp` on `PATH` or installed through WinGet;
- Deno is used as the `yt-dlp` JavaScript runtime when available;
- network access only for the download step.

No video or audio media is downloaded.

## Workflow

Run from the repository root:

```powershell
pwsh -File .\tools\a1-harvest\Build-A1HarvestInput.ps1
pwsh -File .\tools\a1-harvest\Download-A1Subtitles.ps1
pwsh -File .\tools\a1-harvest\Audit-A1Subtitles.ps1
```

The downloader stores `yt-dlp` info JSON first, selects the first advertised
track in `vi-orig`, `vi`, `en` priority, and downloads only that VTT. The
metadata evidence distinguishes confirmed absence from an incomplete
download without fetching redundant translated tracks.

The download command is resume-safe: existing metadata and selected VTT files
that pass the usable-cue check are reused. A normal rerun performs network
work only for incomplete sources while preserving partial progress. Pass
`-Refresh` only when a deliberate full online refresh is required.

Generated artifacts:

- `a1-harvest-input.tsv`: locked source identity and metadata for the pass;
- `a1-harvest-urls.txt`: deterministic URL list;
- `A1_Subtitles/<youtube-id>.<track>.vtt`: selected downloaded subtitle track;
- `A1_Subtitles/<youtube-id>.info.json`: downloaded source metadata evidence;
- `a1-download-results.tsv`: per-source downloader exit status;
- `a1-subtitle-audit.tsv`: per-source classification and selected track;
- `a1-subtitle-audit-summary.ini`: reconciled coverage counts.

## Audit semantics

Track selection follows this priority:

```text
vi-orig -> vi -> en
```

The audit records a source-level state and a separate evidence state:

- `VTT_USABLE / DOWNLOADED`: a requested VTT has a `WEBVTT` header and a
  valid, non-empty cue; `selected_track` records the first usable priority
  track.
- `NO_VTT / METADATA_CONFIRMED`: downloaded info JSON confirms that none of
  the three requested tracks is advertised and no requested VTT exists.
- `VTT_UNUSABLE / DOWNLOADED`: a requested VTT was downloaded but does not
  pass the usable-cue check.
- `UNKNOWN / RATE_LIMITED`: HTTP 429 interrupted the required download.
- `UNKNOWN / DOWNLOAD_FAILED`: another network, tool, metadata, or download
  failure left the source unresolved.

Rate limits, timeouts, blocked requests, and failed downloads are never
reported as `NO_VTT`.
