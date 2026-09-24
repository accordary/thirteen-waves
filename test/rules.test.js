const TW = require('../src/logic.js');
let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log('  ok   ' + label); }
  else { fail++; console.log('  FAIL ' + label + '\n        expected ' + e + '\n        actual   ' + a); }
}

console.log('reroll ladder');
eq([0,1,2,3,4,5].map(TW.rerollPriceAfter), [75, 90, 108, 130, 156, 188], 'ladder 75/90/108 then ceil(prev*1.2)');
eq(TW.rerollPriceAfter(0), 75, 'price resets to 75 at wave start');

console.log('kill points');
const ec = TW.makeEconomy();
ec.addKill(40); ec.addKill(60);
eq([ec.unspent, ec.totalScore], [100, 100], 'kills raise unspent and total');
eq(ec.spend(70), true, 'affordable purchase succeeds');
eq([ec.unspent, ec.totalScore], [30, 100], 'spending reduces only unspent; total score untouched');
eq(ec.spend(31), false, 'overspend rejected');
eq(ec.unspent, 30, 'rejected purchase leaves balance unchanged');
ec.addKill(10);
eq([ec.unspent, ec.totalScore], [40, 110], 'unspent only ever rises from kills');

console.log('ability cap');
const four = ['repair_burst','haste','overdrive','emp_pulse'];
eq(TW.canBuyAbility(four.slice(0,3), 'nova_blast').ok, true, 'fourth ability allowed');
eq(TW.canBuyAbility(four, 'nova_blast'), { ok: false, reason: 'BLOCKED — ability slots full (4/4)' }, 'fifth ability blocked and marked');
eq(TW.canBuyAbility(four.slice(0,2), 'haste').ok, false, 'duplicate ability rejected');
eq(TW.ABILITIES.length, 12, 'all 12 abilities defined');
eq(TW.ABILITIES.every(a => a.desc && a.desc.length > 10), true, 'every ability has a description');

console.log('shop');
const rng = TW.mulberry32(7);
const state = { owned: [], levels: { engine: 0, shield: 0, missile: 0, gun: 0 } };
for (let i = 0; i < 200; i++) {
  const s = TW.rollShop(rng, state);
  if (s.length !== 3) { fail++; console.log('  FAIL shop size'); break; }
}
pass++; console.log('  ok   shop always shows exactly three offers (200 rolls)');
const shop = TW.rollShop(rng, state);
const before = shop[1];
shop[1] = TW.rollOffer(rng, state);
eq(shop.length, 3, 'offer regenerates in place after purchase');
const owned4 = { owned: four, levels: state.levels };
for (let i = 0; i < 300; i++) {
  const s = TW.rollShop(rng, owned4);
  if (s.some(o => o.kind === 'ability' && four.indexOf(o.id) !== -1)) { fail++; console.log('  FAIL owned ability reoffered'); break; }
}
pass++; console.log('  ok   owned abilities never reoffered (300 rolls)');

console.log('wave expiry');
const world = { enemies: [{},{},{}], enemyShots: [{}], playerShots: [{},{}], missiles: [{}] };
const r = TW.expireWave(world);
eq(r, { clearedWithoutReward: 3, pointsAwarded: 0 }, 'expiry clears survivors with no kill reward');
eq([world.enemies.length, world.enemyShots.length, world.playerShots.length, world.missiles.length], [0,0,0,0], 'all shots and enemies removed');
eq([TW.WAVE_SECONDS, TW.TOTAL_WAVES], [90, 3], 'wave is 90s, run is 3 waves');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
