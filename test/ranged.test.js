/* Milestone 34: ranged (shooter) enemy - roster gating, telegraph, no unavoidable spawn damage. */
var fs = require('fs');
var path = require('path');
var T = require('../src/game.js');
var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('ok   - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function eq(name, a, b) { ok(name + ' (' + a + ' == ' + b + ')', a === b); }

var S = T.ENEMY_TYPES.shooter;
eq('shooter behavior is ranged', S.behavior, 'ranged');
eq('shooter telegraph is 0.6s', S.telegraph, 0.6);
ok('shooter has a firing range', typeof S.range === 'number' && S.range > 0);

ok('shooter absent from wave 1', T.waveRoster(1).indexOf('shooter') < 0);
ok('shooter present from wave 2', T.waveRoster(2).indexOf('shooter') >= 0);
ok('shooter still present in wave 3', T.waveRoster(3).indexOf('shooter') >= 0);

/* A fresh shooter cannot fire immediately: attackTimer plus telegraph must elapse first. */
var g = new T.Game(11); g.start();
var e = g.makeEnemy('shooter', g.player.x + 120, g.player.y);
ok('fresh shooter starts with a non-zero attack timer', e.attackTimer > 0);
ok('first shot cannot land inside 1.6s', e.attackTimer + S.telegraph >= 1.6);

/* Simulate the shooter in isolation (updateEnemy, so wave spawns do not interfere). */
g.enemies.length = 0; g.hostileShots.length = 0; g.hazards.length = 0;
var dt = 1 / 60, t = 0, firstShotAt = null, firstTelegraphAt = null, sawTelegraphEvent = false;
for (var i = 0; i < 600 && firstShotAt === null; i++) {
  g.updateEnemy(e, dt); t += dt;
  if (firstTelegraphAt === null && e.telegraph > 0) firstTelegraphAt = t;
  if (g.drainEvents().indexOf('telegraph:shot') >= 0) sawTelegraphEvent = true;
  if (g.hostileShots.length > 0) firstShotAt = t;
}
ok('shooter eventually fires a hostile shot', firstShotAt !== null);
ok('a telegraph event precedes the shot', sawTelegraphEvent);
ok('telegraph is visible before the shot', firstTelegraphAt !== null && firstShotAt - firstTelegraphAt >= 0.5);
ok('no hostile shot inside the first 1.6s', firstShotAt !== null && firstShotAt >= 1.6);
var shot = g.hostileShots[0];
ok('hostile shot is damaging and moving', shot && shot.damage > 0 && (shot.vx !== 0 || shot.vy !== 0));

/* Render contract: the browser draw pass covers the shooter colour, shots, hazards and telegraph. */
var main = fs.readFileSync(path.join(__dirname, '..', 'src', 'main.js'), 'utf8');
ok('draw pass renders hostileShots', /hostileShots/.test(main));
ok('draw pass renders hazards', /hazards/.test(main));
ok('draw pass renders the telegraph wind-up', /telegraph/.test(main));
ok('shooter has a distinct colour', /shooter\s*:/.test(main) && /8e44ad/i.test(main));

console.log('# pass ' + pass + ' # fail ' + fail);
if (fail) process.exit(1);
