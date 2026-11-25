/* Coin Run: an original one-button runner starring Penny the piggy bank. */
(() => {
  'use strict';

  // ---------- Pixel sprites (original designs) ----------
  const PAL = {
    K: '#1b1b1b', P: '#f7a6c0', D: '#d9607f', W: '#ffffff',
    Y: '#fcbc3c', O: '#c87a00', B: '#2a62d8', R: '#e0301e',
  };
  const PIG = [
    '..KK......KK....',
    '.KDPK....KDPK...',
    '.KPPPKKKKKPPPK..',
    'KPPPPPYYYPPPPPK.',
    'KBBBBBBBBBBBBBK.',
    'KPPPPPPPPPWKPPPK',
    'KPPPPPPPPPWKPKKK',
    'KPPPPPPPPPPPKDDK',
    'KPPPPPPPPPPPKDDK',
    '.KPPPPPPPPPPPKK.',
    '..KPPPPPPPPPPK..',
  ];
  const ENV = [
    'KKKKKKKKKKKKKK',
    'KWKWWWWWWWWKWK',
    'KWWKWWWWWWKWWK',
    'KWWWKWWWWKWWWK',
    'KWRRWKWWKWRRWK',
    'KWWRWWKKWWRWWK',
    'KWWWWWWWWWWWWK',
    'KWWWWKKKKWWWWK',
    'KKKKKKKKKKKKKK',
  ];
  const SPRITES = {
    pigA: [...PIG, '..KDDK....KDDK..', '..KKKK....KKKK..'],
    pigB: [...PIG, '...KDDK..KDDK...', '...KKKK..KKKK...'],
    pigJ: [...PIG, '.KDDK......KDDK.', '.KKK........KKK.'],
    envA: [...ENV, '..KK......KK..', '.KKK......KKK.'],
    envB: [...ENV, '...KK....KK...', '..KKK....KKK..'],
    envFlat: ['KKKKKKKKKKKKKK', 'KWWWKWWWWKWWWK', 'KWRWWKKKKWWRWK', 'KKKKKKKKKKKKKK'],
    coin: ['..KKKK..', '.KYYYYK.', 'KYYWYYOK', 'KYWYYYOK', 'KYWYYYOK', 'KYWYYYOK', 'KYYYYYOK', 'KYYYYOOK', '.KOOOOK.', '..KKKK..'],
    coinE: ['...KK...', '..KYOK..', '..KWOK..', '..KWOK..', '..KWOK..', '..KWOK..', '..KWOK..', '..KYOK..', '..KYOK..', '...KK...'],
    heart: ['.KK.KK.', 'KRRKRRK', 'KRWRRRK', '.KRRRK.', '..KRK..', '...K...'],
  };
  const cache = new Map();
  function sprite(name) {
    if (cache.has(name)) return cache.get(name);
    const rows = SPRITES[name];
    const w = Math.max(...rows.map(r => r.length));
    const c = document.createElement('canvas');
    c.width = w; c.height = rows.length;
    const x = c.getContext('2d');
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = PAL[row[i]];
        if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); }
      }
    });
    cache.set(name, c);
    return c;
  }
  function drawSprite(canvas, name, scale = 4) {
    const s = sprite(name);
    canvas.width = s.width * scale;
    canvas.height = s.height * scale;
    const x = canvas.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(s, 0, 0, canvas.width, canvas.height);
  }

  // ---------- Game constants ----------
  const H = 200, GY = 168, PX = 44, PH = 13;
  const G = 1500, JUMP_V = -430, HOLD_G = 0.4, MAX_HOLD = 0.22, ENEMY_V = 25;
  const FONT = '"Press Start 2P", ui-monospace, monospace';

  let overlay, stage, canvas, ctx, livesEl;
  let W = 320, scale = 1, raf = 0, last = 0, isOpen = false;
  let mode = 'ready'; // ready | run | paused | dying | over
  let runActive = false, opts = null, g = null, best = 0, newBest = false;
  let msg = '', msgT = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const snd = name => { try { window.Sound && window.Sound[name] && window.Sound[name](); } catch (e) { /* ignore */ } };
  const isNight = () => document.documentElement.dataset.theme === 'dark' ||
    (document.documentElement.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);

  function newRun() {
    g = {
      t: 0, speed: 130, dist: 0, y: GY - PH, vy: 0, onGround: true, lastGround: 0, falling: false,
      hold: false, holdT: 0, buf: 0, coins: [], enemies: [], gaps: [], texts: [], cool: 140,
      score: 0, shield: !!(opts && opts.shield && opts.shield()), inv: 0, animT: 0,
      bgOff: g ? g.bgOff : 0, groundOff: 0, deathT: 0, overT: 0,
    };
  }

  // ---------- Spawning ----------
  function coinRow(x, y, n) { for (let i = 0; i < n; i++) g.coins.push({ x: x + i * 14, y }); }
  function coinArc(cx, y) { [[-14, 8], [0, 0], [14, 8]].forEach(([dx, dy]) => g.coins.push({ x: cx + dx, y: y + dy })); }
  function addEnemy(x) { g.enemies.push({ x, y: GY - 11, dead: false, deadT: 0 }); }
  function spawn() {
    const x0 = W + 12, r = Math.random();
    if (g.t < 2.5) { coinRow(x0, GY - 26, 4); return 56; }
    if (r < 0.3) { addEnemy(x0); if (Math.random() < 0.5) coinArc(x0 + 3, GY - 50); return 20; }
    if (r < 0.56) {
      const w = Math.round(rand(34, Math.min(90, 40 + g.speed * 0.16)));
      g.gaps.push({ x: x0, w }); coinArc(x0 + w / 2 - 4, GY - 54); return w;
    }
    if (r < 0.76) { coinRow(x0, Math.random() < 0.4 ? GY - 62 : GY - 26, 5); return 70; }
    if (r < 0.9 && g.t > 12) { addEnemy(x0); addEnemy(x0 + 34); return 50; }
    const w = Math.round(rand(34, 56));
    g.gaps.push({ x: x0, w }); coinRow(x0 + w + 20, GY - 26, 3); return w + 62;
  }

  const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function text(s, x, y, color = '#fff') { g.texts.push({ s, x, y, t: 0, color }); }

  // ---------- Update ----------
  function update(dt) {
    g.animT += dt;
    if (msgT > 0) msgT -= dt;
    if (mode === 'ready') { g.bgOff += 18 * dt; return; }
    if (mode === 'over') { g.overT += dt; return; }
    if (mode === 'dying') {
      g.deathT += dt; g.vy = Math.min(g.vy + G * dt, 600); g.y += g.vy * dt;
      if (g.deathT > 1.1 || g.y > H + 40) endRun();
      return;
    }
    // running
    g.t += dt;
    g.speed = Math.min(320, 130 + g.t * 3.2);
    const dx = g.speed * dt;
    g.dist += dx; g.bgOff += dx; g.groundOff = (g.groundOff + dx) % 16;
    g.inv = Math.max(0, g.inv - dt);
    g.buf = Math.max(0, g.buf - dt);

    for (const c of g.coins) c.x -= dx;
    for (const p of g.gaps) p.x -= dx;
    for (const e of g.enemies) { e.x -= dx + (e.dead ? 0 : ENEMY_V * dt); if (e.dead) e.deadT += dt; }
    for (const t of g.texts) { t.y -= 22 * dt; t.t += dt; }
    g.coins = g.coins.filter(c => !c.taken && c.x > -12);
    g.gaps = g.gaps.filter(p => p.x + p.w > -4);
    g.enemies = g.enemies.filter(e => e.x > -20 && !(e.dead && e.deadT > 0.5));
    g.texts = g.texts.filter(t => t.t < 0.8);

    g.cool -= dx;
    if (g.cool <= 0) g.cool = spawn() + g.speed * rand(0.6, 1.05) + 30;

    // jump (with coyote time + input buffer)
    const canJump = g.onGround || (!g.falling && g.vy >= 0 && g.t - g.lastGround < 0.08);
    if (g.buf > 0 && canJump) {
      g.vy = JUMP_V; g.onGround = false; g.holdT = 0; g.buf = 0; g.lastGround = -1; snd('jump');
    }
    let grav = G;
    if (g.hold && g.vy < 0 && g.holdT < MAX_HOLD) { grav = G * HOLD_G; g.holdT += dt; }
    const prevBottom = g.y + PH;
    g.vy = Math.min(g.vy + grav * dt, 600);
    g.y += g.vy * dt;

    const overGap = g.gaps.some(p => PX + 4 >= p.x && PX + 12 <= p.x + p.w);
    if (!g.falling) {
      if (g.y + PH >= GY) {
        if (!overGap && prevBottom <= GY + 0.5) {
          g.y = GY - PH; g.vy = 0; g.onGround = true; g.lastGround = g.t;
        } else {
          g.onGround = false;
          if (g.y + PH > GY + 6) g.falling = true;
        }
      } else g.onGround = false;
    }
    if (g.y > H + 10) { die(true); return; }

    const pb = { x: PX + 2, y: g.y + 1, w: 12, h: PH - 1 };
    for (const c of g.coins) {
      if (hit(pb, { x: c.x, y: c.y, w: 8, h: 10 })) { c.taken = true; g.score++; snd('coin'); text('+1', c.x, c.y - 4, '#fcbc3c'); }
    }
    for (const e of g.enemies) {
      if (e.dead) continue;
      if (!hit(pb, { x: e.x + 1, y: e.y + 2, w: 12, h: 9 })) continue;
      if (g.vy > 0 && prevBottom <= e.y + 6) {
        e.dead = true; g.vy = JUMP_V * 0.7; g.holdT = MAX_HOLD; g.score += 5;
        snd('stomp'); text('+5', e.x, e.y - 8, '#fff');
      } else if (g.inv <= 0) {
        if (g.shield) { g.shield = false; g.inv = 1.5; snd('hit'); text('SHIELD!', PX - 8, g.y - 10, '#fcbc3c'); }
        else { die(false); return; }
      }
    }
  }

  function die(fell) {
    mode = 'dying'; g.deathT = 0; g.hold = false;
    if (!fell) g.vy = -320;
    snd('hit');
  }
  function endRun() {
    mode = 'over'; g.overT = 0; runActive = false;
    const prev = best;
    best = opts.onEnd(g.score);
    newBest = g.score > prev && g.score > 0;
    snd('over');
    updateLives();
  }
  function tryStart() {
    if (!opts.canStart()) { msg = 'NO LIVES LEFT'; msgT = 1.6; return; }
    opts.onStart();
    newRun();
    mode = 'run'; runActive = true; newBest = false;
    updateLives();
  }

  // ---------- Input ----------
  function press() {
    if (mode === 'ready') return tryStart();
    if (mode === 'paused') { mode = 'run'; last = performance.now(); return; }
    if (mode === 'over') { if (g.overT > 0.6) tryStart(); return; }
    if (mode === 'run') { g.buf = 0.12; g.hold = true; }
  }
  function release() { if (g) g.hold = false; }

  // ---------- Drawing ----------
  function txt(s, x, y, size = 8, align = 'left', color = '#fff') {
    ctx.font = `${size}px ${FONT}`;
    ctx.textAlign = align; ctx.textBaseline = 'top';
    ctx.fillStyle = '#1b1b1b'; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = color; ctx.fillText(s, x, y);
  }
  const wrap = (v, span) => ((v % span) + span) % span;

  function cloud(x, y, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x + 10, y, 20, 6);
    ctx.fillRect(x + 4, y + 6, 36, 6);
    ctx.fillRect(x, y + 12, 46, 6);
  }
  function hill(x, w, h, col, dark) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x + w / 2, GY, w / 2, h, 0, Math.PI, 0); ctx.fill();
    ctx.fillStyle = dark;
    ctx.fillRect(x + w * 0.35, GY - h * 0.55, 3, 6);
    ctx.fillRect(x + w * 0.6, GY - h * 0.7, 3, 6);
  }
  function drawGround() {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, GY, W, H - GY);
    for (const p of g.gaps) ctx.rect(p.x, GY, p.w, H - GY);
    ctx.clip('evenodd');
    ctx.fillStyle = '#c84c0c'; ctx.fillRect(0, GY, W, H - GY);
    ctx.fillStyle = '#7a2800';
    for (let y = GY, row = 0; y < H; y += 8, row++) {
      ctx.fillRect(0, y, W, 1);
      const off = (row % 2) * 8;
      for (let x = off - g.groundOff - 16; x < W; x += 16) ctx.fillRect(Math.round(x), y, 1, 8);
    }
    ctx.fillStyle = '#1b1b1b'; ctx.fillRect(0, GY, W, 1);
    ctx.fillStyle = '#fc9838'; ctx.fillRect(0, GY + 1, W, 1);
    ctx.restore();
    ctx.fillStyle = '#1b1b1b';
    for (const p of g.gaps) { ctx.fillRect(Math.round(p.x) - 1, GY, 1, H - GY); ctx.fillRect(Math.round(p.x + p.w), GY, 1, H - GY); }
  }
  function panel(h) {
    const w = Math.min(W - 24, 236), x = (W - w) / 2, y = (H - h) / 2 - 14;
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#fcbc3c'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    return y;
  }

  function draw() {
    const night = isNight();
    ctx.fillStyle = night ? '#0b1440' : '#5c94fc';
    ctx.fillRect(0, 0, W, H);
    if (night) {
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 28; i++) ctx.fillRect(Math.round(wrap(i * 73 - g.bgOff * 0.05, W)), (i * 37) % 110 + 4, 1, 1);
    }
    for (let i = 0; i < 4; i++) cloud(wrap(i * 130 - g.bgOff * 0.15, W + 80) - 60, 22 + (i * 29) % 52, night ? '#3a4a85' : '#fff');
    for (let i = 0; i < 3; i++) {
      const span = W + 180;
      hill(wrap(i * 170 - g.bgOff * 0.4, span) - 90, 110 + (i % 2) * 30, i % 2 ? 42 : 28,
        night ? '#0d5c1a' : '#00a800', night ? '#063a10' : '#006400');
    }
    drawGround();

    const coinFrame = Math.floor(g.animT * 5) % 3 === 2 ? 'coinE' : 'coin';
    for (const c of g.coins) ctx.drawImage(sprite(coinFrame), Math.round(c.x), Math.round(c.y));
    const envFrame = Math.floor(g.animT * 6) % 2 ? 'envA' : 'envB';
    for (const e of g.enemies) {
      if (e.dead) ctx.drawImage(sprite('envFlat'), Math.round(e.x), GY - 4);
      else ctx.drawImage(sprite(envFrame), Math.round(e.x), Math.round(e.y));
    }

    // player
    let pf = 'pigA';
    if (mode === 'run' || mode === 'paused') pf = g.onGround ? (Math.floor(g.dist / 10) % 2 ? 'pigA' : 'pigB') : 'pigJ';
    else if (mode === 'dying') pf = 'pigJ';
    const show = !(g.inv > 0 && Math.floor(g.inv * 12) % 2);
    if (mode !== 'over' && show) {
      if (g.shield) {
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(g.animT * 8);
        ctx.strokeStyle = '#fcbc3c'; ctx.lineWidth = 2;
        ctx.strokeRect(PX - 3, Math.round(g.y) - 3, 22, PH + 6);
        ctx.globalAlpha = 1;
      }
      ctx.drawImage(sprite(pf), PX, Math.round(g.y));
    }
    for (const t of g.texts) txt(t.s, Math.round(t.x), Math.round(t.y), 6, 'left', t.color);

    // HUD
    ctx.drawImage(sprite('coin'), 6, 6);
    txt('x' + g.score, 18, 8, 8);
    txt('BEST ' + best, W - 6, 8, 8, 'right');
    if (g.shield && mode === 'run') txt('SHIELD', W - 6, 20, 6, 'right', '#fcbc3c');

    const blink = Math.floor(g.animT * 2) % 2 === 0;
    if (mode === 'ready') {
      const y = panel(104);
      txt('COIN RUN', W / 2, y + 12, 14, 'center', '#fcbc3c');
      if (blink) txt('TAP TO START', W / 2, y + 38, 8, 'center');
      txt('USES 1 LIFE  (' + opts.lives() + ' LEFT)', W / 2, y + 58, 6, 'center', '#ddd');
      txt(g.shield ? 'UNDER BUDGET: SHIELD ON!' : 'STAY UNDER BUDGET FOR A SHIELD', W / 2, y + 76, 6, 'center', g.shield ? '#fcbc3c' : '#bbb');
    } else if (mode === 'paused') {
      const y = panel(64);
      txt('PAUSED', W / 2, y + 14, 12, 'center', '#fcbc3c');
      txt('TAP TO RESUME', W / 2, y + 38, 8, 'center');
    } else if (mode === 'over') {
      const lives = opts.lives();
      const y = panel(120);
      txt('GAME OVER', W / 2, y + 12, 14, 'center', '#e0301e');
      txt('SCORE ' + g.score + '   BEST ' + best, W / 2, y + 36, 8, 'center');
      if (newBest && blink) txt('NEW BEST!', W / 2, y + 52, 8, 'center', '#fcbc3c');
      if (lives > 0) {
        if (g.overT > 0.6) txt('TAP TO PLAY AGAIN', W / 2, y + 74, 8, 'center');
        txt('USES 1 LIFE  (' + lives + ' LEFT)', W / 2, y + 92, 6, 'center', '#ddd');
      } else {
        txt('NO LIVES LEFT', W / 2, y + 72, 8, 'center', '#fcbc3c');
        txt('LOG AN ENTRY IN YOUR BUDGET', W / 2, y + 88, 6, 'center', '#ddd');
        txt('TO EARN ANOTHER LIFE', W / 2, y + 100, 6, 'center', '#ddd');
      }
    }
    if (msgT > 0 && mode !== 'over') txt(msg, W / 2, H - 22, 8, 'center', '#fcbc3c');
  }

  function frame(now) {
    if (!isOpen) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (mode !== 'paused') update(dt); else g.animT += dt;
    draw();
  }

  function resize() {
    if (!isOpen) return;
    const cw = stage.clientWidth, ch = stage.clientHeight;
    if (!cw || !ch) return;
    W = Math.round(Math.max(240, Math.min(420, H * cw / ch)));
    scale = Math.min(cw / W, ch / H);
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = Math.floor(W * scale) + 'px';
    canvas.style.height = Math.floor(H * scale) + 'px';
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
  }

  function updateLives() {
    if (!opts || !livesEl) return;
    const n = opts.lives();
    livesEl.innerHTML = '♥'.repeat(n) + '<span class="empty">' + '♥'.repeat(Math.max(0, 3 - n)) + '</span>';
    livesEl.setAttribute('aria-label', n + ' of 3 lives');
  }

  function open(o) {
    opts = o; best = o.best();
    isOpen = true; mode = 'ready'; runActive = false; msgT = 0;
    newRun();
    overlay.hidden = false;
    document.body.classList.add('no-scroll');
    resize();
    updateLives();
    if (document.fonts && document.fonts.load) document.fonts.load('8px "Press Start 2P"').catch(() => {});
    last = performance.now();
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }
  function close() {
    if (!isOpen) return;
    if (runActive) { runActive = false; best = opts.onEnd(g.score); }
    isOpen = false;
    cancelAnimationFrame(raf);
    overlay.hidden = true;
    document.body.classList.remove('no-scroll');
    if (opts.onClose) opts.onClose();
  }

  function init() {
    overlay = document.getElementById('game');
    stage = document.getElementById('game-stage');
    canvas = document.getElementById('game-canvas');
    livesEl = document.getElementById('game-lives');
    ctx = canvas.getContext('2d');

    overlay.addEventListener('pointerdown', e => {
      if (e.target.closest('button')) return;
      e.preventDefault();
      press();
    });
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    overlay.addEventListener('contextmenu', e => e.preventDefault());
    document.getElementById('game-close').addEventListener('click', close);
    window.addEventListener('keydown', e => {
      if (!isOpen) return;
      if (e.code === 'Escape') { close(); return; }
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!e.repeat) press();
      }
    });
    window.addEventListener('keyup', e => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') release();
    });
    window.addEventListener('resize', resize);
    const pause = () => { if (isOpen && mode === 'run') { mode = 'paused'; release(); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
    window.addEventListener('blur', pause);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.CoinRun = { open, close, drawSprite };
})();
