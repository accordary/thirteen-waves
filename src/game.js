/* Thirteen Waves - core game logic (no DOM). Milestone 22: playable core loop, wave 1. */
(function (root) {
  'use strict';

  var CFG = {
    width: 960, height: 600,
    waveSeconds: 90,
    playerSpeed: 260, playerRadius: 14,
    hullMax: 100, shieldMax: 60, shieldRegen: 4, shieldRegenDelay: 3,
    bulletSpeed: 560, bulletRadius: 4, bulletDamage: 10, fireCooldown: 0.18,
    chaserSpeed: 78, chaserRadius: 13, chaserHp: 20, chaserDamage: 12,
    contactCooldown: 0.8, spawnInterval: 1.6, maxEnemies: 24, killPoints: 10
  };

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
    this.state = 'onboarding';      // onboarding | playing | paused | waveComplete | gameOver
    this.wave = 1;
    this.timeLeft = CFG.waveSeconds;
    this.score = 0;
    this.killPoints = 0;
    this.kills = 0;
    this.player = { x: CFG.width / 2, y: CFG.height / 2, hull: CFG.hullMax, shield: CFG.shieldMax,
                    radius: CFG.playerRadius, fireTimer: 0, sinceHit: 99, hitFlash: 0 };
    this.bullets = [];
    this.enemies = [];
    this.spawnTimer = 0;
    this.events = [];
  };

  Game.prototype.start = function () { if (this.state === 'onboarding') this.state = 'playing'; };

  Game.prototype.togglePause = function () {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  };

  Game.prototype.spawnEnemy = function () {
    var edge = Math.floor(this.random() * 4), x, y;
    if (edge === 0) { x = this.random() * CFG.width; y = -20; }
    else if (edge === 1) { x = this.random() * CFG.width; y = CFG.height + 20; }
    else if (edge === 2) { x = -20; y = this.random() * CFG.height; }
    else { x = CFG.width + 20; y = this.random() * CFG.height; }
    this.enemies.push({ type: 'chaser', x: x, y: y, hp: CFG.chaserHp, radius: CFG.chaserRadius,
                        touchTimer: 0, hitFlash: 0 });
  };

  Game.prototype.fire = function (aimX, aimY) {
    if (this.state !== 'playing' || this.player.fireTimer > 0) return false;
    var p = this.player, dx = aimX - p.x, dy = aimY - p.y, m = Math.sqrt(dx * dx + dy * dy) || 1;
    this.bullets.push({ x: p.x, y: p.y, vx: dx / m * CFG.bulletSpeed, vy: dy / m * CFG.bulletSpeed,
                        radius: CFG.bulletRadius, life: 2 });
    p.fireTimer = CFG.fireCooldown;
    this.events.push('shot');
    return true;
  };

  Game.prototype.damagePlayer = function (amount) {
    var p = this.player, remain = amount;
    if (p.shield > 0) { var a = Math.min(p.shield, remain); p.shield -= a; remain -= a; this.events.push('shieldHit'); }
    if (remain > 0) { p.hull = Math.max(0, p.hull - remain); this.events.push('hullHit'); }
    p.sinceHit = 0; p.damagedThisFrame = true; p.hitFlash = 0.15;
    if (p.hull <= 0) this.state = 'gameOver';
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
      this.spawnEnemy(); this.spawnTimer = c.spawnInterval;
    }

    var i, j, b, e;
    for (i = this.bullets.length - 1; i >= 0; i--) {
      b = this.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0 || b.x < -40 || b.x > c.width + 40 || b.y < -40 || b.y > c.height + 40) this.bullets.splice(i, 1);
    }

    for (i = this.enemies.length - 1; i >= 0; i--) {
      e = this.enemies[i];
      var dx = p.x - e.x, dy = p.y - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      e.x += dx / d * c.chaserSpeed * dt; e.y += dy / d * c.chaserSpeed * dt;
      e.touchTimer = Math.max(0, e.touchTimer - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);

      for (j = this.bullets.length - 1; j >= 0; j--) {
        b = this.bullets[j];
        if (dist(b, e) <= e.radius + b.radius) {
          e.hp -= c.bulletDamage; e.hitFlash = 0.12; this.bullets.splice(j, 1);
          this.events.push('enemyHit');
          break;
        }
      }
      if (e.hp <= 0) {
        this.enemies.splice(i, 1);
        this.kills++; this.score += c.killPoints; this.killPoints += c.killPoints;
        this.events.push('kill');
        continue;
      }
      if (dist(p, e) <= e.radius + p.radius && e.touchTimer === 0) {
        e.touchTimer = c.contactCooldown;
        this.damagePlayer(c.chaserDamage);
        if (this.state === 'gameOver') return;
      }
    }

    // regen resolves after collisions so a frame with damage never also regenerates
    if (!p.damagedThisFrame && p.sinceHit > c.shieldRegenDelay) p.shield = Math.min(c.shieldMax, p.shield + c.shieldRegen * dt);

    this.timeLeft -= dt;
    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      // wave expiry: clear remaining enemies and shots, no kill rewards
      this.enemies.length = 0; this.bullets.length = 0;
      this.state = 'waveComplete';
      this.events.push('waveComplete');
    }
  };

  Game.prototype.drainEvents = function () { var e = this.events; this.events = []; return e; };

  var api = { Game: Game, CFG: CFG };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  // logic.js also publishes root.TW; merge so the browser build has both halves
  var prev = root.TW; if (prev) { for (var k in api) if (Object.prototype.hasOwnProperty.call(api, k)) prev[k] = api[k]; }
  else root.TW = api;
})(typeof window !== 'undefined' ? window : globalThis);
