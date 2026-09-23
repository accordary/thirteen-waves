/* Thirteen Waves - core game logic (no DOM).
   Milestone 22: playable core loop, wave 1.
   Milestone 23: six enemy behaviors, damage types + designated weaknesses,
                 attack/hazard telegraphs, wave progression and pacing. */
(function (root) {
  'use strict';

  var CFG = {
    width: 960, height: 600,
    waveSeconds: 90, totalWaves: 13,
    playerSpeed: 260, playerRadius: 14,
    hullMax: 100, shieldMax: 60, shieldRegen: 4, shieldRegenDelay: 3,
    bulletSpeed: 560, bulletRadius: 4, bulletDamage: 10, fireCooldown: 0.18,
    chaserSpeed: 78, chaserRadius: 13, chaserHp: 20, chaserDamage: 12,
    contactCooldown: 0.8, spawnInterval: 1.6, maxEnemies: 24, killPoints: 10,
    weaknessMultiplier: 2,
    hostileShotSpeed: 210, hostileShotRadius: 5, hostileShotDamage: 9,
    hazardDamage: 7, hazardTick: 0.5
  };

  var DAMAGE_TYPES = ['plasma', 'ion', 'cryonic', 'gravitic'];

  /* Six readable behaviors. telegraph = seconds of visible wind-up before an attack/hazard. */
  var ENEMY_TYPES = {
    chaser:     { name: 'Chaser',    behavior: 'seek',    hp: 20,  speed: 78,  radius: 13, contact: 12,
                  weakness: 'plasma',   points: 10, telegraph: 0 },
    shooter:    { name: 'Shooter',   behavior: 'ranged',  hp: 26,  speed: 62,  radius: 13, contact: 8,
                  weakness: 'ion',      points: 14, telegraph: 0.6, range: 260, fireInterval: 2.2 },
    flanker:    { name: 'Flanker',   behavior: 'flank',   hp: 16,  speed: 155, radius: 11, contact: 10,
                  weakness: 'cryonic',  points: 16, telegraph: 0.35, dashInterval: 2.6 },
    tank:       { name: 'Tank',      behavior: 'armored', hp: 90,  speed: 42,  radius: 22, contact: 20,
                  weakness: 'gravitic', points: 30, telegraph: 0, armor: 0.5 },
    splitter:   { name: 'Splitter',  behavior: 'split',   hp: 34,  speed: 70,  radius: 18, contact: 12,
                  weakness: 'cryonic',  points: 18, telegraph: 0, shards: 2 },
    controller: { name: 'Controller', behavior: 'area',   hp: 40,  speed: 50,  radius: 16, contact: 10,
                  weakness: 'ion',      points: 22, telegraph: 1.0, hazardInterval: 4, hazardRadius: 70,
                  hazardLife: 5 },
    shard:      { name: 'Shard',     behavior: 'seek',    hp: 10,  speed: 120, radius: 9,  contact: 7,
                  weakness: 'plasma',   points: 6, telegraph: 0 }
  };

  /* Pacing: roster widens and density rises as waves progress. */
  function waveRoster(wave) {
    var r = ['chaser'];
    if (wave >= 2) r.push('shooter');
    if (wave >= 3) r.push('flanker');
    if (wave >= 4) r.push('splitter');
    if (wave >= 5) r.push('tank');
    if (wave >= 6) r.push('controller');
    return r;
  }
  function waveSpawnInterval(wave) { return Math.max(0.55, CFG.spawnInterval - (wave - 1) * 0.08); }
  function waveHpScale(wave) { return 1 + (wave - 1) * 0.12; }

  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function Game(seed) {
    this.cfg = CFG;
    this.rngState = (seed === undefined ? 12345 : seed) >>> 0;
    this.reset();
  }

  Game.prototype.random = function () {
    // deterministic LCG so tests are reproducible
    this.rngState = (this.rngState * 1664525 + 1013904223) >>> 0;
    return this.rngState / 4294967296;
  };

  Game.prototype.reset = function () {
    this.state = 'onboarding';      // onboarding | playing | paused | waveComplete | victory | gameOver
    this.wave = 1;
    this.timeLeft = CFG.waveSeconds;
    this.score = 0;
    this.killPoints = 0;
    this.kills = 0;
    this.damageType = 'plasma';
    this.player = { x: CFG.width / 2, y: CFG.height / 2, hull: CFG.hullMax, shield: CFG.shieldMax,
                    radius: CFG.playerRadius, fireTimer: 0, sinceHit: 99, hitFlash: 0 };
    this.bullets = [];
    this.hostileShots = [];
    this.hazards = [];
    this.enemies = [];
    this.spawnTimer = 0;
    this.events = [];
  };

  Game.prototype.start = function () { if (this.state === 'onboarding') this.state = 'playing'; };

  Game.prototype.togglePause = function () {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  };

  Game.prototype.setDamageType = function (t) {
    if (DAMAGE_TYPES.indexOf(t) >= 0) { this.damageType = t; this.events.push('damageType:' + t); return true; }
    return false;
  };

  /* Wave progression: from waveComplete into the next 90s wave, or victory after 13. */
  Game.prototype.nextWave = function () {
    if (this.state !== 'waveComplete') return false;
    if (this.wave >= CFG.totalWaves) { this.state = 'victory'; this.events.push('victory'); return false; }
    this.wave += 1;
    this.timeLeft = CFG.waveSeconds;
    this.spawnTimer = 0;
    this.hostileShots.length = 0;
    this.hazards.length = 0;
    this.state = 'playing';
    this.events.push('waveStart:' + this.wave);
    return true;
  };

  Game.prototype.makeEnemy = function (type, x, y) {
    var t = ENEMY_TYPES[type], hp = Math.round(t.hp * waveHpScale(this.wave));
    return { type: type, name: t.name, behavior: t.behavior, x: x, y: y,
             hp: hp, maxHp: hp, radius: t.radius, speed: t.speed,
             weakness: t.weakness, points: t.points, armor: t.armor || 0,
             telegraph: 0, telegraphMax: t.telegraph, attackTimer: 1 + this.random() * 2,
             touchTimer: 0, hitFlash: 0, weakFlash: 0 };
  };

  Game.prototype.spawnEnemy = function (type) {
    var edge = Math.floor(this.random() * 4), x, y;
    if (edge === 0) { x = this.random() * CFG.width; y = -20; }
    else if (edge === 1) { x = this.random() * CFG.width; y = CFG.height + 20; }
    else if (edge === 2) { x = -20; y = this.random() * CFG.height; }
    else { x = CFG.width + 20; y = this.random() * CFG.height; }
    if (!type) {
      var roster = waveRoster(this.wave);
      type = roster[Math.floor(this.random() * roster.length)];
    }
    this.enemies.push(this.makeEnemy(type, x, y));
  };

  Game.prototype.fire = function (aimX, aimY) {
    if (this.state !== 'playing' || this.player.fireTimer > 0) return false;
    var p = this.player, dx = aimX - p.x, dy = aimY - p.y, m = Math.sqrt(dx * dx + dy * dy) || 1;
    this.bullets.push({ x: p.x, y: p.y, vx: dx / m * CFG.bulletSpeed, vy: dy / m * CFG.bulletSpeed,
                        radius: CFG.bulletRadius, life: 2, damageType: this.damageType });
    p.fireTimer = CFG.fireCooldown;
    this.events.push('shot');
    return true;
  };

  /* Matching the designated weakness deals 2x with explicit feedback; every type still kills. */
  Game.prototype.damageEnemy = function (e, amount, damageType) {
    var dmg = amount, weak = damageType && damageType === e.weakness;
    if (weak) dmg *= CFG.weaknessMultiplier;
    else if (e.armor) dmg *= (1 - e.armor);
    e.hp -= dmg;
    e.hitFlash = 0.12;
    if (weak) { e.weakFlash = 0.25; this.events.push('weaknessHit'); }
    else this.events.push('enemyHit');
    return dmg;
  };

  Game.prototype.damagePlayer = function (amount) {
    var p = this.player, remain = amount;
    if (p.shield > 0) { var a = Math.min(p.shield, remain); p.shield -= a; remain -= a; this.events.push('shieldHit'); }
    if (remain > 0) { p.hull = Math.max(0, p.hull - remain); this.events.push('hullHit'); }
    p.sinceHit = 0; p.damagedThisFrame = true; p.hitFlash = 0.15;
    if (p.hull <= 0) this.state = 'gameOver';
  };

  Game.prototype.killEnemy = function (e, index) {
    this.enemies.splice(index, 1);
    this.kills++; this.score += e.points; this.killPoints += e.points;
    this.events.push('kill');
    if (e.behavior === 'split') {
      var n = ENEMY_TYPES.splitter.shards;
      for (var s = 0; s < n; s++) {
        var sh = this.makeEnemy('shard', e.x + (s ? 14 : -14), e.y);
        this.enemies.push(sh);
      }
      this.events.push('split');
    }
  };

  Game.prototype.hostileShot = function (e) {
    var p = this.player, dx = p.x - e.x, dy = p.y - e.y, m = Math.sqrt(dx * dx + dy * dy) || 1;
    this.hostileShots.push({ x: e.x, y: e.y, vx: dx / m * CFG.hostileShotSpeed, vy: dy / m * CFG.hostileShotSpeed,
                             radius: CFG.hostileShotRadius, life: 4, damage: CFG.hostileShotDamage });
    this.events.push('enemyShot');
  };

  Game.prototype.dropHazard = function (e) {
    var t = ENEMY_TYPES.controller;
    this.hazards.push({ x: e.x, y: e.y, radius: t.hazardRadius, life: t.hazardLife, tick: 0 });
    this.events.push('hazard');
  };

  /* Behavior movement + telegraphed attacks. */
  Game.prototype.updateEnemy = function (e, dt) {
    var p = this.player, dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
    var t = ENEMY_TYPES[e.type], ux = dx / d, uy = dy / d;

    if (e.telegraph > 0) {
      // winding up: hold position so the tell is readable, then resolve the attack
      e.telegraph -= dt;
      if (e.telegraph <= 0) {
        e.telegraph = 0;
        if (e.behavior === 'ranged') this.hostileShot(e);
        else if (e.behavior === 'area') this.dropHazard(e);
        else if (e.behavior === 'flank') { e.dash = 0.45; }
      }
      return;
    }

    e.attackTimer -= dt;
    switch (e.behavior) {
      case 'ranged':
        if (d > t.range) { e.x += ux * e.speed * dt; e.y += uy * e.speed * dt; }
        else if (d < t.range * 0.6) { e.x -= ux * e.speed * dt; e.y -= uy * e.speed * dt; }
        if (e.attackTimer <= 0 && d <= t.range) {
          e.telegraph = t.telegraph; e.attackTimer = t.fireInterval; this.events.push('telegraph:shot');
        }
        break;
      case 'flank': {
        var px = -uy, py = ux;                       // strafe perpendicular, close in on dash
        var sp = e.speed * (e.dash > 0 ? 2.2 : 1);
        if (e.dash > 0) { e.dash -= dt; e.x += ux * sp * dt; e.y += uy * sp * dt; }
        else { e.x += (ux * 0.45 + px * 0.9) * sp * dt; e.y += (uy * 0.45 + py * 0.9) * sp * dt; }
        if (e.attackTimer <= 0) {
          e.telegraph = t.telegraph; e.attackTimer = t.dashInterval; this.events.push('telegraph:dash');
        }
        break;
      }
      case 'area':
        e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
        if (e.attackTimer <= 0) {
          e.telegraph = t.telegraph; e.attackTimer = t.hazardInterval; this.events.push('telegraph:hazard');
        }
        break;
      default: // seek, armored, split all close directly; speed/armor make them read differently
        e.x += ux * e.speed * dt; e.y += uy * e.speed * dt;
    }
  };

  // input: {up,down,left,right,firing,aimX,aimY}
  Game.prototype.update = function (dt, input) {
    if (this.state !== 'playing') return;
    this.player.damagedThisFrame = false;
    input = input || {};
    dt = Math.min(dt, 0.05);
    var p = this.player, c = CFG;

    var mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    if (mx || my) { var m = Math.sqrt(mx * mx + my * my); 
      p.x = clamp(p.x + mx / m * c.playerSpeed * dt, p.radius, c.width - p.radius);
      p.y = clamp(p.y + my / m * c.playerSpeed * dt, p.radius, c.height - p.radius); }

    p.fireTimer = Math.max(0, p.fireTimer - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    p.sinceHit += dt;
    if (input.firing) this.fire(input.aimX === undefined ? p.x : input.aimX,
                                input.aimY === undefined ? p.y - 1 : input.aimY);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0 && this.enemies.length < c.maxEnemies) {
      this.spawnEnemy(); this.spawnTimer = waveSpawnInterval(this.wave);
    }

    var i, j, b, e;
    for (i = this.bullets.length - 1; i >= 0; i--) {
      b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > c.width + 40 || b.y < -40 || b.y > c.height + 40) this.bullets.splice(i, 1);
    }

    for (i = this.hostileShots.length - 1; i >= 0; i--) {
      b = this.hostileShots[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (dist(b, p) <= b.radius + p.radius) {
        this.hostileShots.splice(i, 1);
        this.damagePlayer(b.damage);
        if (this.state === 'gameOver') return;
        continue;
      }
      if (b.life <= 0 || b.x < -40 || b.x > c.width + 40 || b.y < -40 || b.y > c.height + 40) this.hostileShots.splice(i, 1);
    }

    for (i = this.hazards.length - 1; i >= 0; i--) {
      var hz = this.hazards[i];
      hz.life -= dt; hz.tick -= dt;
      if (hz.tick <= 0 && dist(hz, p) <= hz.radius + p.radius) {
        hz.tick = c.hazardTick;
        this.damagePlayer(c.hazardDamage);
        if (this.state === 'gameOver') return;
      }
      if (hz.life <= 0) this.hazards.splice(i, 1);
    }

    for (i = this.enemies.length - 1; i >= 0; i--) {
      e = this.enemies[i];
      this.updateEnemy(e, dt);
      e.touchTimer = Math.max(0, e.touchTimer - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.weakFlash = Math.max(0, e.weakFlash - dt);

      for (j = this.bullets.length - 1; j >= 0; j--) {
        b = this.bullets[j];
        if (dist(b, e) <= e.radius + b.radius) {
          this.bullets.splice(j, 1);
          this.damageEnemy(e, c.bulletDamage, b.damageType);
          break;
        }
      }
      if (e.hp <= 0) { this.killEnemy(e, i); continue; }
      if (dist(p, e) <= e.radius + p.radius && e.touchTimer === 0) {
        e.touchTimer = c.contactCooldown;
        this.damagePlayer(ENEMY_TYPES[e.type].contact);
        if (this.state === 'gameOver') return;
      }
    }

    // regen resolves after collisions so a frame with damage never also regenerates
    if (!p.damagedThisFrame && p.sinceHit > c.shieldRegenDelay) p.shield = Math.min(c.shieldMax, p.shield + c.shieldRegen * dt);

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      // wave expiry: clear remaining enemies and hostile shots/hazards, no kill rewards
      this.enemies.length = 0; this.bullets.length = 0;
      this.hostileShots.length = 0; this.hazards.length = 0;
      this.state = 'waveComplete';
      this.events.push('waveComplete');
    }
  };

  Game.prototype.drainEvents = function () { var e = this.events; this.events = []; return e; };

  var api = { Game: Game, CFG: CFG, ENEMY_TYPES: ENEMY_TYPES, DAMAGE_TYPES: DAMAGE_TYPES,
              waveRoster: waveRoster, waveSpawnInterval: waveSpawnInterval, waveHpScale: waveHpScale };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  // logic.js also publishes root.TW; merge so the browser build has both halves
  var prev = root.TW; if (prev) { for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) prev[k] = api[k]; }
  else root.TW = api;
})(typeof window !== 'undefined' ? window : globalThis);
