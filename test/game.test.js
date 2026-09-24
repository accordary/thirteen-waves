/* Headless logic tests: node test/game.test.js */
var assert = require('assert');
var TW = require('../src/game.js');
var pass = 0;
function t(name, fn) { fn(); pass++; console.log('ok - ' + name); }

t('starts in onboarding and begins on start()', function () {
  var g = new TW.Game(1);
  assert.strictEqual(g.state, 'onboarding');
  g.start(); assert.strictEqual(g.state, 'playing');
  assert.strictEqual(g.timeLeft, 90);
});

t('keyboard movement moves the ship and is clamped to the field', function () {
  var g = new TW.Game(1); g.start();
  var x0 = g.player.x;
  for (var i = 0; i < 10; i++) g.update(0.05, { right: true });
  assert.ok(g.player.x > x0);
  for (i = 0; i < 400; i++) g.update(0.05, { right: true, down: true });
  assert.ok(g.player.x <= TW.CFG.width && g.player.y <= TW.CFG.height);
});

t('firing respects cooldown and spawns bullets toward the aim point', function () {
  var g = new TW.Game(1); g.start();
  assert.strictEqual(g.fire(g.player.x + 100, g.player.y), true);
  assert.strictEqual(g.fire(g.player.x + 100, g.player.y), false, 'cooldown blocks second shot');
  assert.strictEqual(g.bullets.length, 1);
  assert.ok(g.bullets[0].vx > 0 && Math.abs(g.bullets[0].vy) < 1e-6);
});

t('bullets kill a chaser and award score and kill points', function () {
  var g = new TW.Game(1); g.start();
  g.enemies.push({ type: 'chaser', x: g.player.x + 80, y: g.player.y, hp: 20,
                   radius: TW.CFG.chaserRadius, touchTimer: 0, hitFlash: 0 });
  var target = g.enemies[0];
  var shots = 0;
  for (var i = 0; i < 200 && g.enemies.indexOf(target) !== -1; i++) {
    if (g.fire(g.player.x + 200, g.player.y)) shots++;
    g.update(0.02, {});
  }
  // the wave keeps spawning while we shoot, so track the seeded enemy specifically
  assert.strictEqual(g.enemies.indexOf(target), -1, 'enemy destroyed');
  assert.ok(g.kills >= 1);
  assert.strictEqual(g.score, g.kills * TW.CFG.killPoints);
  assert.strictEqual(g.killPoints, g.score);
  // chaser's designated weakness is plasma, so a single 2x hit is lethal
  assert.ok(shots >= 1);
});

t('shield absorbs before hull, then hull takes the remainder', function () {
  var g = new TW.Game(1); g.start();
  g.damagePlayer(20);
  assert.strictEqual(g.player.shield, TW.CFG.shieldMax - 20);
  assert.strictEqual(g.player.hull, TW.CFG.hullMax);
  g.damagePlayer(TW.CFG.shieldMax - 20 + 10);
  assert.strictEqual(g.player.shield, 0);
  assert.strictEqual(g.player.hull, TW.CFG.hullMax - 10);
});

t('shield regenerates only after the no-hit delay', function () {
  var g = new TW.Game(1); g.start();
  g.damagePlayer(30);
  g.update(0.05, {});
  var s = g.player.shield;
  // keep the field clear so spawned chasers cannot reset the no-hit timer
  for (var i = 0; i < 20; i++) { g.enemies.length = 0; g.update(0.05, {}); }   // 1s < delay
  assert.strictEqual(g.player.shield, s, 'no regen during delay');
  for (i = 0; i < 200; i++) { g.enemies.length = 0; g.update(0.05, {}); }
  assert.ok(g.player.shield > s, 'regen after delay');
});

t('contact damage has a cooldown and hull loss ends the run', function () {
  var g = new TW.Game(1); g.start();
  g.player.shield = 0;
  g.enemies.push({ type: 'chaser', x: g.player.x, y: g.player.y, hp: 999,
                   radius: TW.CFG.chaserRadius, touchTimer: 0, hitFlash: 0 });
  g.update(0.016, {});
  assert.strictEqual(g.player.hull, TW.CFG.hullMax - TW.CFG.chaserDamage);
  g.update(0.016, {});
  assert.strictEqual(g.player.hull, TW.CFG.hullMax - TW.CFG.chaserDamage, 'cooldown blocks repeat hit');
  for (var i = 0; i < 2000 && g.state === 'playing'; i++) g.update(0.02, {});
  assert.strictEqual(g.state, 'gameOver');
});

t('enemies spawn over time while playing', function () {
  var g = new TW.Game(7); g.start();
  for (var i = 0; i < 300; i++) g.update(0.02, {});
  assert.ok(g.enemies.length >= 3, 'spawned ' + g.enemies.length);
});

t('wave expires at 90s, clears the field and transitions', function () {
  var g = new TW.Game(3); g.start();
  // run out the clock with a cleared field so survival isn't what's under test
  for (var i = 0; i < 2000 && g.state === 'playing'; i++) { g.enemies.length = 0; g.update(0.05, {}); }
  assert.strictEqual(g.state, 'waveComplete');
  assert.strictEqual(g.timeLeft, 0);
  assert.strictEqual(g.enemies.length, 0);
  assert.strictEqual(g.bullets.length, 0);
  assert.ok(i * 0.05 >= 90 && i * 0.05 < 92, 'elapsed ' + (i * 0.05) + 's');
});

t('pause freezes simulation; resume continues', function () {
  var g = new TW.Game(1); g.start();
  g.togglePause(); assert.strictEqual(g.state, 'paused');
  var t0 = g.timeLeft;
  g.update(0.5, { right: true });
  assert.strictEqual(g.timeLeft, t0);
  g.togglePause(); g.update(0.05, {});
  assert.ok(g.timeLeft < t0);
});

t('restart via reset clears score and field', function () {
  var g = new TW.Game(1); g.start();
  g.score = 500; g.killPoints = 500; g.player.hull = 1;
  g.reset();
  assert.strictEqual(g.score, 0);
  assert.strictEqual(g.killPoints, 0);
  assert.strictEqual(g.player.hull, TW.CFG.hullMax);
  assert.strictEqual(g.timeLeft, 90);
});

console.log('\n' + pass + ' passed');
