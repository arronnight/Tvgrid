# TVGRID

A retro cable control room for the browser: twelve live, procedurally animated
channels on a wall of CRT televisions, a scrollable program guide, and a
fast-paced **Signal Hunt** matching game.

## What is in the box

- **Twelve channels** — late-night talk, weather radar, public access, shopping,
  synth music, news, cartoons, grindhouse movies, deep space, sitcoms, cooking,
  and a test pattern. Every screen is drawn live on canvas.
- **Multiview presets** — 2×2, 3×2, 3×3, and 4×3 walls, with channel selection,
  favorites, and a full-screen monitor.
- **Program guide** — a four-hour schedule grid with a live time cursor. Click
  any program to tune that channel.
- **Signal Hunt** — match a target broadcast against the wall before the timer
  runs out. Five rounds, score, streaks, penalties, and a saved best score.
- **Control-room details** — power standby, tuner static, scanlines, local time,
  now-playing ticker, keyboard shortcuts, and optional synthesized audio.
- **No build step** — plain HTML, CSS, and ES modules. Settings persist in
  `localStorage`.

## Controls

| Action | Control |
| --- | --- |
| Open program guide | `G` or the Guide button |
| Start Signal Hunt | `S` or the Signal Hunt button |
| Power standby | `P` or the power button |
| Move around the wall | Arrow keys |
| Full-screen selected channel | `Enter` on a focused TV or the Expand button |
| Close overlays / leave a game | `Esc` |
| Change layout | The 2×2 / 3×2 / 3×3 / 4×3 switch |

## Run locally

```bash
python3 -m http.server 3000
```

Then open <http://localhost:3000>.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Remixed using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/arronnight/Tvgrid)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/arronnight/Tvgrid)

- 🎮 [Open the project](https://omgithub.com/arronnight/Tvgrid).
- ✨ [Remix this project](https://omgithub.com/?remix=arronnight%2FTvgrid).
- 💻 [Explore the source](https://github.com/arronnight/Tvgrid).
- 🛠️ [Check build runs](https://github.com/arronnight/Tvgrid/actions).
- 🐛 [Report an issue](https://github.com/arronnight/Tvgrid/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/arronnight).
- 🌍 [Create with OMGithub](https://omgithub.com).
- 🧬 [Explore the remix source](https://github.com/arronnight/Tvgrid).
<!-- omgithub:readme:end -->
