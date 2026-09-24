/* Wave-pacing regression guard for the three-wave rebalance (milestone 35).
   Pure arithmetic over CFG/ENEMY_TYPES: locks the difficulty budget so a
   future edit cannot silently restore the rejected "unreasonably hard" run. */
const TW = require('../src/game.js');
let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n        expected ' + e + '\n        actual   ' + a); }
}
function ok(cond, label, detail) {
  if (cond) { pass++; console.log('  ok   ' + label + (detail ? ' (' + detail + ')' : '')); }
  else { fail++; console.log('  FAIL ' + label + (detail ? ' (' + detail + ')' : '')); }
}
const CFG = TW.CFG, TYPES = TW.ENEMY_TYPES;
const waves = [1, 2, 3];

console.log('wave roster stays sequential');
eq(TW.waveRoster(1), ['chaser'], 'wave 1 introduces one readable type');
waves.forEach(w => ok(TW.waveRoster(w).length >= TW.waveRoster(Math.max(1, w - 1)).length,
  'roster never shrinks at wave ' + w, TW.waveRoster(w).join('/')));
eq(CFG.totalWaves, 3, 'run is three waves');

console.log('density budget');
waves.forEach(w => {
  const si = TW.waveSpawnInterval(w);
  ok(si >= 1.1, 'wave ' + w + ' spawn interval is not crowding', si.toFixed(2) + 's');
});
ok(TW.waveSpawnInterval(3) >= TW.waveSpawnInterval(1) - 0.5,
  'wave 3 density ramp is gentle', TW.waveSpawnInterval(1) + 's -> ' + TW.waveSpawnInterval(3) + 's');
ok(CFG.maxEnemies <= 14, 'concurrent enemy cap bounded', String(CFG.maxEnemies));

console.log('hp ramp');
ok(TW.waveHpScale(3) <= 1.25, 'wave 3 HP scale stays under 1.25x', TW.waveHpScale(3).toFixed(2) + 'x');

console.log('time-to-kill (unweakened shots, worst type per wave)');
function ttk(type, wave) {
  const t = TYPES[type];
  const hp = t.hp * TW.waveHpScale(wave);
  const dmg = CFG.bulletDamage * (1 - (t.armor || 0));
  return Math.ceil(hp / dmg) * CFG.fireCooldown;
}
waves.forEach(w => {
  const worst = TW.waveRoster(w).map(t => [t, ttk(t, w)]).sort((a, b) => b[1] - a[1])[0];
  ok(worst[1] <= 1.0, 'wave ' + w + ' toughest spawn dies within 1s of fire',
    worst[0] + ' ' + worst[1].toFixed(2) + 's');
});

console.log('player survivability');
const pool = CFG.hullMax + CFG.shieldMax;
waves.forEach(w => {
  const worst = TW.waveRoster(w).map(t => TYPES[t].contact).sort((a, b) => b - a)[0];
  const hits = Math.floor(pool / worst);
  ok(hits >= 12, 'wave ' + w + ' survives >=12 worst-case contacts', hits + ' hits (' + worst + ' dmg)');
});
ok(CFG.shieldRegen * (CFG.waveSeconds - CFG.shieldRegenDelay) >= CFG.shieldMax,
  'shield fully recovers within a wave of uninterrupted regen');

console.log('reward pacing: shop reachable before wave 2');
const wave1Rate = CFG.waveSeconds / TW.waveSpawnInterval(1);
const wave1Points = Math.floor(wave1Rate) * TYPES.chaser.points;
ok(wave1Points >= 300, 'wave 1 clear funds a purchase', wave1Points + ' pts from ~' + Math.floor(wave1Rate) + ' kills');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
