# Thirteen Waves

Browser-playable top-down 2D space shooter. This build delivers the three-wave expedition run:
three sequential 90-second waves with escalating encounters.

## Play it

No build step and no dependencies — it is plain HTML/JS. Serve the folder over HTTP:

```bash
git clone https://github.com/Accordary/thirteen-waves.git
cd thirteen-waves
python3 -m http.server 8080     # or: npx serve .
```

Open <http://localhost:8080> and press **Space** (or click) to launch.
Opening `index.html` directly from disk also works in most browsers.

## Controls

| Action | Input |
| --- | --- |
| Move | `W A S D` or arrow keys |
| Aim | mouse |
| Fire | hold left mouse button |
| Pause / resume | `P` or `Esc` |
| Restart | `R` |
| Mute | `M` (button also available) |
| Volume | slider below the play field |

## What is in this build

- Three sequential 90-second waves with a live timer and wave indicator; on expiry remaining enemies
  and shots are cleared with no kill rewards and the wave-complete screen appears. Clearing wave 3
  ends the run with a victory summary; hull at zero ends it with a loss summary. `R` restarts a
  fresh run with all progression reset.
- Escalating encounters: wave 1 chasers; wave 2 adds shooters and flankers; wave 3 adds splitters,
  tanks and controllers. Spawn interval tightens and enemy HP scales each wave.
- Basic chaser enemies that spawn from the field edges and home in on the player.
- Hull and shields: shields absorb damage first and recharge after 3 seconds without being hit;
  hull damage is permanent within a run. Hull at zero ends the run with a summary.
- Score and unspent kill points tracked separately, plus a local best score (`localStorage`).
- HUD with hull, shields, wave, timer, score, kill points and best score.
- Onboarding overlay explaining goal, controls and the shield model; pause, restart, mute/volume.
- Hit/kill/shield/hull audio cues and hit flashes for readable feedback.

## Not in this build (later milestones)

The shop and upgrades, abilities and ability slots, damage types/resistances, and the
five remaining enemy behaviors.

## Tests

```bash
node test/game.test.js
```

Headless logic tests covering movement, firing cooldown, kill rewards, shield/hull damage, shield
regen delay, contact-damage cooldown, spawning, 90-second wave expiry, pause and restart.

## Layout

- `index.html` — page, HUD markup, styles
- `src/game.js` — DOM-free game logic (also loadable with `require` in Node)
- `src/main.js` — rendering, input, audio, HUD and overlay wiring
- `test/game.test.js` — headless tests
