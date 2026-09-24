/* Between-wave shop: affordability, effects, continue action, restart reset. */
var assert = require('assert');
var TW = require('../src/game.js');
var Game = TW.Game || (TW.TW && TW.TW.Game) || (typeof global.TW !== 'undefined' && global.TW.Game);
var CFG = TW.CFG || (TW.TW && TW.TW.CFG) || global.TW.CFG;
var passed = 0;
function t(name, fn) { fn(); passed++; console.log('ok - ' + name); }

function atWaveComplete(wave, kp) {
  var g = new Game(7); g.start(); g.wave = wave; g.state = 'waveComplete'; g.killPoints = kp; return g;
}

t('shop opens after wave 1 and wave 2', function () {
  assert.strictEqual(atWaveComplete(1, 0).openShop(), true);
  assert.strictEqual(atWaveComplete(2, 0).openShop(), true);
});
t('no shop after final wave', function () {
  var g = atWaveComplete(CFG.totalWaves, 500);
  assert.strictEqual(g.openShop(), false);
  assert.strictEqual(g.state, 'waveComplete');
});
t('repair blocked when unaffordable', function () {
  var g = atWaveComplete(1, 10); g.openShop(); g.player.hull = 50;
  assert.strictEqual(g.buyRepair(), false);
  assert.strictEqual(g.player.hull, 50);
  assert.strictEqual(g.killPoints, 10);
});
t('repair heals 35 and charges its price', function () {
  var g = atWaveComplete(1, 100); g.openShop(); g.player.hull = 50;
  assert.strictEqual(g.buyRepair(), true);
  assert.strictEqual(g.player.hull, 85);
  assert.strictEqual(g.killPoints, 100 - g.shopPrices().repair);
});
t('repair blocked at full hull', function () {
  var g = atWaveComplete(1, 100); g.openShop();
  assert.strictEqual(g.buyRepair(), false);
});
t('weapon upgrade raises level, shortens cooldown and raises next price', function () {
  var g = atWaveComplete(1, 200); g.openShop();
  var first = g.shopPrices().weapon;
  assert.strictEqual(g.buyWeapon(), true);
  assert.strictEqual(g.weaponLevel, 1);
  assert.ok(g.shopPrices().weapon > first);
  g.closeShop();
  g.player.fireTimer = 0;
  g.fire(500, 300);
  assert.ok(g.player.fireTimer < CFG.fireCooldown);
});
t('continue action leaves shop and starts next wave', function () {
  var g = atWaveComplete(1, 0); g.openShop();
  assert.strictEqual(g.closeShop(), true);
  assert.strictEqual(g.state, 'playing');
  assert.strictEqual(g.wave, 2);
  assert.strictEqual(g.timeLeft, CFG.waveSeconds);
});
t('restart resets purchases', function () {
  var g = atWaveComplete(1, 200); g.openShop(); g.buyWeapon(); g.reset();
  assert.strictEqual(g.weaponLevel, 0);
  assert.strictEqual(g.killPoints, 0);
  assert.strictEqual(g.player.hull, CFG.hullMax);
});
console.log(passed + ' passed');
