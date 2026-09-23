/* Pure, headless game rules. Loadable in the browser (window.TW) and in node (require). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const TOTAL_WAVES = 13;
  const WAVE_SECONDS = 90;
  const BASE_REROLL = 75;
  const MAX_ABILITIES = 4;

  const ABILITIES = [
    { id: 'repair_burst',       name: 'Repair Burst',       cost: 120, cooldown: 18, desc: 'Instantly restores 35 hull.' },
    { id: 'shield_recharge',    name: 'Shield Recharge',    cost: 110, cooldown: 16, desc: 'Refills shields to full immediately.' },
    { id: 'overdrive',          name: 'Overdrive',          cost: 140, cooldown: 22, desc: 'Doubles gun fire rate for 6s.' },
    { id: 'haste',              name: 'Haste',              cost: 100, cooldown: 14, desc: 'Increases engine speed by 70% for 6s.' },
    { id: 'missile_salvo',      name: 'Missile Salvo',      cost: 150, cooldown: 20, desc: 'Fires 8 homing missiles at once.' },
    { id: 'emp_pulse',          name: 'EMP Pulse',          cost: 130, cooldown: 20, desc: 'Stuns every enemy on screen for 3s.' },
    { id: 'time_dilation',      name: 'Time Dilation',      cost: 160, cooldown: 26, desc: 'Slows enemies and enemy shots to 35% for 5s.' },
    { id: 'phase_shift',        name: 'Phase Shift',        cost: 145, cooldown: 24, desc: 'Become untargetable and immune for 3s.' },
    { id: 'gravity_well',       name: 'Gravity Well',       cost: 135, cooldown: 22, desc: 'Drops a well that pulls in and crushes enemies for 4s.' },
    { id: 'decoy_drone',        name: 'Decoy Drone',        cost: 115, cooldown: 20, desc: 'Deploys a decoy enemies shoot at for 6s.' },
    { id: 'nova_blast',         name: 'Nova Blast',         cost: 170, cooldown: 28, desc: 'Expanding shockwave dealing 60 damage to all enemies.' },
    { id: 'emergency_barrier',  name: 'Emergency Barrier',  cost: 125, cooldown: 24, desc: 'Absorbs the next 3 hits taken within 8s.' }
  ];

  const UPGRADES = [
    { id: 'engine',  name: 'Engine Tuning',   desc: '+12% thrust and top speed.' },
    { id: 'shield',  name: 'Shield Capacitor', desc: '+20 max shields, +15% regen.' },
    { id: 'missile', name: 'Missile Rack',     desc: '+1 missile per salvo, +10% missile damage.' },
    { id: 'gun',     name: 'Gun Calibration',  desc: '+12% gun damage, +8% fire rate.' }
  ];

  /* Reroll ladder: 75, then each next = ceil(prev * 1.2) -> 90, 108, 130, 156, ... */
  function nextRerollPrice(prev) { return Math.ceil(prev * 1.2); }
  function rerollPriceAfter(rerolls) {
    let p = BASE_REROLL;
    for (let i = 0; i < rerolls; i++) p = nextRerollPrice(p);
    return p;
  }

  /* Unspent kill points rise only on kills; purchases reduce only the unspent balance.
     Total score is a separate, never-decreasing tally. */
  function makeEconomy() {
    return {
      unspent: 0,
      totalScore: 0,
      spent: 0,
      kills: 0,
      addKill(points) {
        this.kills += 1;
        this.unspent += points;
        this.totalScore += points;
      },
      spend(cost) {
        if (cost > this.unspent) return false;
        this.unspent -= cost;
        this.spent += cost;
        return true;
      }
    };
  }

  function upgradeCost(level) { return Math.ceil(60 * Math.pow(1.35, level)); }

  function canBuyAbility(owned, id) {
    if (owned.indexOf(id) !== -1) return { ok: false, reason: 'Already equipped' };
    if (owned.length >= MAX_ABILITIES) return { ok: false, reason: 'BLOCKED — ability slots full (4/4)' };
    return { ok: true, reason: '' };
  }

  function rollOffer(rng, state) {
    const pool = [];
    UPGRADES.forEach(u => pool.push({ kind: 'upgrade', id: u.id, name: u.name, desc: u.desc, cost: upgradeCost(state.levels[u.id] || 0) }));
    ABILITIES.forEach(a => {
      if (state.owned.indexOf(a.id) === -1) pool.push({ kind: 'ability', id: a.id, name: a.name, desc: a.desc, cost: a.cost });
    });
    return pool[Math.floor(rng() * pool.length)];
  }

  /* The shop always shows exactly three offers. */
  function rollShop(rng, state) {
    const offers = [];
    while (offers.length < 3) {
      const o = rollOffer(rng, state);
      if (!offers.some(x => x.kind === o.kind && x.id === o.id)) offers.push(o);
    }
    return offers;
  }

  /* Wave expiry clears survivors and in-flight shots and awards nothing. */
  function expireWave(world) {
    const cleared = world.enemies.length;
    world.enemies = [];
    world.enemyShots = [];
    world.playerShots = [];
    world.missiles = [];
    return { clearedWithoutReward: cleared, pointsAwarded: 0 };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return { TOTAL_WAVES, WAVE_SECONDS, BASE_REROLL, MAX_ABILITIES, ABILITIES, UPGRADES,
    nextRerollPrice, rerollPriceAfter, makeEconomy, upgradeCost, canBuyAbility,
    rollOffer, rollShop, expireWave, mulberry32 };
});
