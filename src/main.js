/* DOM wiring: rendering, input, audio, HUD. */
(function () {
  'use strict';
  var Game = window.TW.Game, CFG = window.TW.CFG;
  var canvas = document.getElementById('view'), ctx = canvas.getContext('2d');
  var hud = document.getElementById('hud'), overlay = document.getElementById('overlay');
  var muteBtn = document.getElementById('mute'), vol = document.getElementById('volume');
  var game = new Game(Date.now() & 0xffff);
  var input = { up: false, down: false, left: false, right: false, firing: false, aimX: CFG.width / 2, aimY: 0 };
  var best = Number(localStorage.getItem('tw13.best') || 0);
  var muted = localStorage.getItem('tw13.muted') === '1';
  var volume = Number(localStorage.getItem('tw13.volume') || 0.4);
  vol.value = volume; muteBtn.textContent = muted ? 'Unmute (M)' : 'Mute (M)';

  var AC = window.AudioContext || window.webkitAudioContext, actx = null;
  function beep(freq, dur, type) {
    if (muted || volume <= 0) return;
    try {
      if (!actx) actx = new AC();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.value = volume * 0.15;
      o.connect(g); g.connect(actx.destination);
      o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur);
    } catch (e) { /* audio unavailable */ }
  }
  var SFX = { shot: [520, 0.06], enemyHit: [300, 0.05], kill: [180, 0.18, 'sawtooth'],
              shieldHit: [740, 0.12], hullHit: [110, 0.25, 'sawtooth'], waveComplete: [880, 0.4, 'triangle'],
              victory: [1046, 0.5, 'triangle'] };

  var KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
                 KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };

  function restart() { game.reset(); game.state = 'playing'; setOverlay(); }

  addEventListener('keydown', function (ev) {
    if (KEYMAP[ev.code]) { input[KEYMAP[ev.code]] = true; ev.preventDefault(); }
    if (ev.code === 'KeyP' || ev.code === 'Escape') { game.togglePause(); setOverlay(); }
    if (ev.code === 'KeyM') { muted = !muted; localStorage.setItem('tw13.muted', muted ? '1' : '0');
                              muteBtn.textContent = muted ? 'Unmute (M)' : 'Mute (M)'; }
    if (ev.code === 'KeyR') { restart(); }
    if (game.state === 'shop' && (ev.code === 'Digit1' || ev.code === 'Digit2')) {
      if (ev.code === 'Digit1') game.buyRepair(); else game.buyWeapon();
      setOverlay();
    }
    if (ev.code === 'Space') { ev.preventDefault();
      if (game.state === 'onboarding') { game.start(); setOverlay(); }
      else if (game.state === 'waveComplete') { if (!game.openShop()) game.nextWave(); setOverlay(); }
      else if (game.state === 'shop') { game.closeShop(); setOverlay(); }
      else if (game.state === 'gameOver' || game.state === 'victory') restart(); }
  });
  addEventListener('keyup', function (ev) { if (KEYMAP[ev.code]) input[KEYMAP[ev.code]] = false; });
  canvas.addEventListener('mousemove', function (ev) {
    var r = canvas.getBoundingClientRect();
    input.aimX = (ev.clientX - r.left) * CFG.width / r.width;
    input.aimY = (ev.clientY - r.top) * CFG.height / r.height;
  });
  canvas.addEventListener('mousedown', function () { if (game.state === 'onboarding') { game.start(); setOverlay(); } input.firing = true; });
  addEventListener('mouseup', function () { input.firing = false; });
  muteBtn.addEventListener('click', function () { muted = !muted; localStorage.setItem('tw13.muted', muted ? '1' : '0');
    muteBtn.textContent = muted ? 'Unmute (M)' : 'Mute (M)'; });
  vol.addEventListener('input', function () { volume = Number(vol.value); localStorage.setItem('tw13.volume', volume); });

  function recordBest() { if (game.score > best) { best = game.score; localStorage.setItem('tw13.best', best); } }

  function setOverlay() {
    var s = game.state, html = '';
    if (s === 'onboarding') {
      html = '<h1>Thirteen Waves</h1><p>Wave 1 of ' + CFG.totalWaves + '. Survive three 90-second waves.</p>' +
        '<ul><li><b>WASD / Arrows</b> — move</li><li><b>Mouse</b> — aim, <b>click/hold</b> — fire</li>' +
        '<li><b>P / Esc</b> — pause, <b>R</b> — restart, <b>M</b> — mute</li></ul>' +
        '<p>Shields absorb damage first and recharge when you avoid hits. Hull does not.</p>' +
        '<p class="cta">Press <b>Space</b> or click to launch</p>';
    } else if (s === 'paused') { html = '<h1>Paused</h1><p class="cta">Press <b>P</b> to resume</p>'; }
    else if (s === 'waveComplete') {
      recordBest();
      html = '<h1>Wave ' + game.wave + ' of ' + CFG.totalWaves + ' complete</h1>' +
        '<p>Kills: ' + game.kills + ' · Score: ' + game.score +
        ' · Kill points: ' + game.killPoints + '</p><p>Best score: ' + best + '</p>' +
        '<p class="cta">Press <b>Space</b> to continue to wave ' + (game.wave + 1) + ' of ' + CFG.totalWaves + '</p>';
    } else if (s === 'shop') {
      var pr = game.shopPrices(), p2 = game.player;
      var repairLine = p2.hull >= CFG.hullMax ? 'hull already full' :
        (game.killPoints >= pr.repair ? 'affordable' : 'not enough kill points');
      var weaponLine = game.killPoints >= pr.weapon ? 'affordable' : 'not enough kill points';
      html = '<h1>Shop \u2014 after wave ' + game.wave + ' of ' + CFG.totalWaves + '</h1>' +
        '<p>Kill points available: <b>' + game.killPoints + '</b></p>' +
        '<ul><li><b>1</b> \u2014 Hull repair, +35 hull (' + pr.repair + ' KP) \u2014 ' + repairLine + '</li>' +
        '<li><b>2</b> \u2014 Weapon upgrade lv' + (game.weaponLevel + 1) + ', 18% faster fire (' + pr.weapon + ' KP) \u2014 ' + weaponLine + '</li></ul>' +
        '<p>Hull ' + Math.ceil(p2.hull) + '/' + CFG.hullMax + ' \u00b7 Weapon level ' + game.weaponLevel + '</p>' +
        '<p class="cta">Press <b>Space</b> to continue to wave ' + (game.wave + 1) + ' of ' + CFG.totalWaves + '</p>';
    } else if (s === 'victory') {
      recordBest();
      html = '<h1>You won — expedition complete</h1>' +
        '<p>Run summary — all ' + CFG.totalWaves + ' waves cleared, kills ' + game.kills +
        ', score ' + game.score + ', kill points ' + game.killPoints + '</p><p>Best score: ' + best + '</p>' +
        '<p class="cta">Press <b>Space</b> or <b>R</b> to start a fresh run</p>';
    } else if (s === 'gameOver') {
      recordBest();
      html = '<h1>Hull breach</h1><p>Run summary — wave ' + game.wave + ' of ' + CFG.totalWaves +
        ', kills ' + game.kills + ', score ' + game.score + '</p><p>Best score: ' + best + '</p>' +
        '<p class="cta">Press <b>Space</b> or <b>R</b> to restart</p>';
    }
    overlay.innerHTML = html;
    overlay.style.display = html ? 'flex' : 'none';
  }

  function bar(label, value, max, color) {
    var pct = Math.max(0, Math.round(value / max * 100));
    return '<span class="lbl">' + label + '</span><span class="bar"><i style="width:' + pct + '%;background:' + color + '"></i></span>' +
      '<span class="num">' + Math.ceil(value) + '</span>';
  }

  function drawHud() {
    var p = game.player;
    hud.innerHTML =
      '<div class="grp">' + bar('HULL', p.hull, CFG.hullMax, '#ff5f6d') + '</div>' +
      '<div class="grp">' + bar('SHLD', p.shield, CFG.shieldMax, '#4fc3f7') + '</div>' +
      '<div class="grp">WAVE <b>' + game.wave + '/' + CFG.totalWaves + '</b></div>' +
      '<div class="grp">TIME <b>' + Math.ceil(game.timeLeft) + 's</b></div>' +
      '<div class="grp">SCORE <b>' + game.score + '</b></div>' +
      '<div class="grp">KP <b>' + game.killPoints + '</b></div>' +
      '<div class="grp">BEST <b>' + best + '</b></div>';
  }

  function render() {
    ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, CFG.width, CFG.height);
    ctx.strokeStyle = '#121a2e'; ctx.lineWidth = 1;
    for (var gx = 0; gx < CFG.width; gx += 60) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, CFG.height); ctx.stroke(); }
    for (var gy = 0; gy < CFG.height; gy += 60) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(CFG.width, gy); ctx.stroke(); }

    ctx.fillStyle = '#ffe08a';
    game.bullets.forEach(function (b) { ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, 6.2832); ctx.fill(); });

    game.enemies.forEach(function (e) {
      const ENEMY_COLORS = { chaser: '#c0392b', shooter: '#8e44ad', flanker: '#d35400',
        splitter: '#16a085', tank: '#7f8c8d', controller: '#2980b9' };
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : (ENEMY_COLORS[e.type] || '#c0392b');
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = '#ff8a80'; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 3, 0, 6.2832); ctx.stroke();
    });

    var p = game.player, ang = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(79,195,247,' + (0.25 + 0.5 * p.shield / CFG.shieldMax) + ')';
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.radius + 7, 0, 6.2832); ctx.stroke();
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(ang);
    ctx.fillStyle = p.hitFlash > 0 ? '#ffffff' : '#7ee787';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-12, 10); ctx.lineTo(-6, 0); ctx.lineTo(-12, -10); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#7ee787'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(input.aimX, input.aimY, 8, 0, 6.2832); ctx.stroke();
  }

  var last = performance.now();
  function loop(now) {
    var dt = (now - last) / 1000; last = now;
    game.update(dt, input);
    game.drainEvents().forEach(function (ev) { var s = SFX[ev]; if (s) beep(s[0], s[1], s[2]); });
    if (game.state === 'waveComplete' || game.state === 'gameOver' || game.state === 'victory') setOverlay();
    render(); drawHud();
    requestAnimationFrame(loop);
  }
  setOverlay(); requestAnimationFrame(loop);
})();
