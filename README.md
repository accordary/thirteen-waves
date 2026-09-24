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
| Shop: buy hull repair | `1` (on the between-wave shop screen) |
| Shop: buy weapon upgrade | `2` (on the between-wave shop screen) |
| Continue to next wave | `Space` |

## What is in this build

- Three sequential 90-second waves with a live timer and wave indicator; on expiry remaining enemies
  and shots are cleared with no kill rewards and the wave-complete screen appears. Clearing wave 3
  ends the run with a victory summary; hull at zero ends it with a loss summary. `R` restarts a
  fresh run with all progression reset.
- Escalating encounters: wave 1 chasers; wave 2 adds shooters and flankers; wave 3 adds splitters,
  tanks and controllers. Spawn interval tightens and enemy HP scales each wave.
- Basic chaser enemies that spawn from the field edges and home in on the player.
- Ranged `shooter` enemy from wave 2 onward, visually distinct from the red chaser (violet body) and
  distinct in stats (26 HP, slower, 14 points). It keeps its distance and fires only after a 0.6s
  telegraph wind-up; a fresh spawn cannot fire for at least ~1.6s (1-3s attack timer + telegraph),
  so there is no unavoidable damage on spawn.
- Hull and shields: shields absorb damage first and recharge after 3 seconds without being hit;
  hull damage is permanent within a run. Hull at zero ends the run with a summary.
- Between-wave shop after waves 1 and 2 (not after wave 3): spend kill points on a hull repair
  (40 KP, +35 hull, blocked when unaffordable or hull already full) or a weapon upgrade
  (60 KP, then 81, then 110 - `ceil(60 * 1.35^level)`), which shortens the fire cooldown by 18%
  per level (0.18s -> 0.148s -> 0.121s). The screen shows the kill-point balance, both prices and
  effects, per-offer affordability and an explicit `Space` continue action. `R` clears purchases.
- Score and unspent kill points tracked separately, plus a local best score (`localStorage`).
- HUD with hull, shields, wave, timer, score, kill points and best score.
- Onboarding overlay explaining goal, controls and the shield model; pause, restart, mute/volume.
- Hit/kill/shield/hull audio cues and hit flashes for readable feedback.

- Accessibility markup: the HUD is an `aria-live="polite"` status region and the overlay an
  `aria-live="assertive"` dialog, so hull/shield/wave changes and wave-complete, shop, victory and
  loss screens are announced by screen readers; the canvas is focusable with a descriptive label and
  focus is visible (`:focus-visible` outline). The controls hint under the field lists every key.

## Not in this build (later milestones)

Reduced-motion and colour-blind options, plus abilities and ability slots, damage types/resistances and the remaining enemy behaviors.

## Tests

```bash
node test/game.test.js
node test/combat.test.js
node test/rules.test.js
node test/shop.test.js
node test/ranged.test.js

# or the whole suite:
node --test test/
```

Headless logic tests covering movement, firing cooldown, kill rewards, shield/hull damage, shield
regen delay, contact-damage cooldown, spawning, 90-second wave expiry, pause and restart, wave
progression to victory, economy rules and the between-wave shop (opening, pricing, affordability,
upgrade effect, continue and restart reset), plus the ranged shooter (wave-2 gating, 0.6s telegraph
before every shot, the ~1.6s no-damage window after spawn, hostile-shot creation and the
shot/hazard/telegraph draw contract in `src/main.js`).

## Layout

- `index.html` — page, HUD markup, styles
- `src/game.js` — DOM-free game logic (also loadable with `require` in Node)
- `src/main.js` — rendering, input, audio, HUD and overlay wiring
- `src/logic.js` — pure economy/shop rules
- `test/game.test.js`, `test/combat.test.js`, `test/rules.test.js`, `test/shop.test.js`,
  `test/ranged.test.js` — headless tests
