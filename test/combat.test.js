/* Milestone 23: enemy roster, weaknesses, damage-type feedback, telegraphs, wave progression. */
var T = require('../src/game.js');
var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; console.log('ok   - ' + name); } else { fail++; console.log('FAIL - ' + name); } }
function eq(name, a, b) { ok(name + ' (' + a + ' == ' + b + ')', a === b); }

var required = ['chaser', 'shooter', 'flanker', 'tank', 'splitter', 'controller'];
eq('six behaviors defined', required.filter(function (k) { return !!T.ENEMY_TYPES[k]; }).length, 6);
ok('behaviors are distinct', new Set(required.map(function (k) { return T.ENEMY_TYPES[k].behavior; })).size === 6);
ok('every type has a designated weakness in a valid damage type',
   required.every(function (k) { return T.DAMAGE_TYPES.indexOf(T.ENEMY_TYPES[k].weakness) >= 0; }));

// weakness = 2x with explicit feedback; non-matching still damages
var g = new T.Game(7); g.start();
var e = g.makeEnemy('chaser', 100, 100);
var matched = g.damageEnemy(e, 10, 'plasma');
var ev = g.drainEvents();
eq('matching damage is doubled', matched, 20);
ok('weakness hit emits feedback event', ev.indexOf('weaknessHit') >= 0);
var e2 = g.makeEnemy('chaser', 100, 100);
var off = g.damageEnemy(e2, 10, 'cryonic');
ok('non-matching damage still hurts (killable with any type)', off > 0 && off < 20);
ok('armored tank takes reduced non-matching damage', g.damageEnemy(g.makeEnemy('tank', 0, 0), 10, 'plasma') === 7.5);

// telegraphs: shooter winds up before firing, controller before a hazard
var gs = new T.Game(3); gs.start(); gs.enemies = [gs.makeEnemy('shooter', gs.player.x + 100, gs.player.y)];
gs.enemies[0].attackTimer = 0; gs.updateEnemy(gs.enemies[0], 0.016);
ok('shooter telegraphs before firing', gs.enemies[0].telegraph > 0 && gs.hostileShots.length === 0);
for (var i = 0; i < 80 && gs.hostileShots.length === 0; i++) gs.updateEnemy(gs.enemies[0], 0.016);
ok('shooter fires after the telegraph resolves', gs.hostileShots.length === 1);
var gc = new T.Game(4); gc.start(); gc.enemies = [gc.makeEnemy('controller', 300, 300)];
gc.enemies[0].attackTimer = 0; gc.updateEnemy(gc.enemies[0], 0.016);
ok('controller telegraphs hazard', gc.enemies[0].telegraph > 0 && gc.hazards.length === 0);
for (var j = 0; j < 120 && gc.hazards.length === 0; j++) gc.updateEnemy(gc.enemies[0], 0.016);
ok('controller drops hazard after telegraph', gc.hazards.length === 1);

// splitter spawns shards on death
var gp = new T.Game(9); gp.start(); gp.enemies = [gp.makeEnemy('splitter', 200, 200)];
gp.enemies[0].hp = 1; gp.damageEnemy(gp.enemies[0], 100, 'cryonic'); gp.killEnemy(gp.enemies[0], 0);
eq('splitter leaves two shards', gp.enemies.length, 2);
eq('shards are shard type', gp.enemies[0].type, 'shard');

// hostile shots and hazards damage the player
var gh = new T.Game(11); gh.start();
gh.hostileShots = [{ x: gh.player.x, y: gh.player.y, vx: 0, vy: 0, radius: 5, life: 2, damage: 9 }];
var sh0 = gh.player.shield; gh.update(0.016, {});
ok('hostile shot damages the player', gh.player.shield < sh0 && gh.hostileShots.length === 0);

// wave progression and pacing
var gw = new T.Game(5); gw.start(); gw.timeLeft = 0.01; gw.update(0.05, {});
eq('wave expires into waveComplete', gw.state, 'waveComplete');
ok('expiry clears field with no reward', gw.enemies.length === 0 && gw.hostileShots.length === 0 && gw.hazards.length === 0);
var before = gw.score; ok('nextWave advances', gw.nextWave() === true);
eq('wave 2', gw.wave, 2);
eq('timer resets to 90', gw.timeLeft, 90);
eq('score untouched by wave change', gw.score, before);
eq('wave 1 roster is chaser only', T.waveRoster(1).join(','), 'chaser');
eq('wave 6+ roster has all six', T.waveRoster(6).length, 6);
ok('spawn interval tightens with waves', T.waveSpawnInterval(6) < T.waveSpawnInterval(1));
ok('enemy hp scales with waves', T.waveHpScale(6) > T.waveHpScale(1));
var gv = new T.Game(1); gv.start(); gv.wave = 13; gv.timeLeft = 0.01; gv.update(0.05, {});
gv.nextWave(); eq('victory after wave 3', gv.state, 'victory');

// damage type switching
var gd = new T.Game(2); gd.start();
ok('damage type switch works', gd.setDamageType('ion') === true && gd.damageType === 'ion');
ok('invalid damage type rejected', gd.setDamageType('nope') === false && gd.damageType === 'ion');

console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
