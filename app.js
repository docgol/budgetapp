/* Coin Quest Budget: app logic */
(() => {
  'use strict';

  const KEY = 'coinquest.v1';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const pad = n => String(n).padStart(2, '0');
  const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const curYM = () => todayStr().slice(0, 7);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const parseAmount = s => {
    let v = String(s || '').trim().replace(/[^0-9.,]/g, '');
    if (v.includes(',') && !v.includes('.')) v = v.replace(',', '.');
    v = v.replace(/,/g, '');
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  };
  function shiftYM(ym, delta) {
    const [y, m] = ym.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  function ymLabel(ym, short) {
    const [y, m] = ym.split('-').map(Number);
    const opts = short ? { month: 'short' } : { month: 'short', year: 'numeric' };
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, opts).toUpperCase().replace('.', '');
  }
  const dayLabel = d => new Date(d + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  // ---------- State ----------
  const DEFAULT_CATS = [
    { id: 'food', name: 'Food', emoji: '🍔', limit: 400 },
    { id: 'home', name: 'Rent & Home', emoji: '🏠', limit: 0 },
    { id: 'move', name: 'Transport', emoji: '🚗', limit: 150 },
    { id: 'bills', name: 'Bills', emoji: '💡', limit: 200 },
    { id: 'fun', name: 'Fun', emoji: '🎮', limit: 100 },
    { id: 'shop', name: 'Shopping', emoji: '🛍️', limit: 150 },
  ];
  const OTHER = { id: '_other', name: 'Other', emoji: '📦', limit: 0 };
  const EMOJIS = ['🍔', '🍕', '☕', '🛒', '🏠', '🚗', '🚌', '⛽', '💡', '📱', '🎮', '🎬', '🛍️', '👕', '💊', '🐶', '✈️', '🎁', '📚', '💪', '⭐', '🍄'];

  const freshState = () => ({
    categories: DEFAULT_CATS.map(c => ({ ...c })),
    transactions: [],
    budgets: {},
    settings: { currency: '$', sound: true },
    game: { lives: 3, best: 0 },
  });

  function normalize(s) {
    const f = freshState();
    if (!s || typeof s !== 'object') return f;
    const settings = { ...f.settings };
    if (s.settings && typeof s.settings === 'object') {
      if (typeof s.settings.currency === 'string') settings.currency = s.settings.currency.slice(0, 4);
      if (typeof s.settings.sound === 'boolean') settings.sound = s.settings.sound;
    }
    return {
      categories: Array.isArray(s.categories)
        ? s.categories.filter(c => c && c.id).map(c => ({
          id: String(c.id), name: String(c.name || 'Untitled').slice(0, 24),
          emoji: String(c.emoji || '⭐').slice(0, 8), limit: Math.max(0, num(c.limit)),
        }))
        : f.categories,
      transactions: Array.isArray(s.transactions)
        ? s.transactions.filter(t => t && t.id && isDate(t.date)).map(t => ({
          id: String(t.id), type: t.type === 'income' ? 'income' : 'expense',
          amount: Math.abs(num(t.amount)), categoryId: t.categoryId ? String(t.categoryId) : null,
          note: String(t.note || '').slice(0, 60), date: t.date,
        }))
        : [],
      budgets: s.budgets && typeof s.budgets === 'object'
        ? Object.fromEntries(Object.entries(s.budgets).filter(([k]) => /^\d{4}-\d{2}$/.test(k)).map(([k, v]) => [k, Math.max(0, num(v))]))
        : {},
      settings,
      game: {
        lives: Math.min(3, Math.max(0, Math.round(num(s.game && s.game.lives != null ? s.game.lives : 3)))),
        best: Math.max(0, Math.round(num(s.game && s.game.best))),
      },
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* fall through */ }
    return freshState();
  }
  let storageWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) {
      if (!storageWarned) { storageWarned = true; toast('Heads up: this browser is not saving data'); }
    }
  }

  let state = load();
  let viewMonth = curYM();

  // ---------- Sound (original chiptune blips) ----------
  const Sound = {
    ctx: null,
    get() {
      if (!state.settings.sound) return null;
      try {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return this.ctx;
      } catch (e) { return null; }
    },
    tone(freq, start, dur, type = 'square', vol = 0.08, slideTo) {
      const c = this.get(); if (!c) return;
      const t = c.currentTime + start;
      const o = c.createOscillator(), gn = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      gn.gain.setValueAtTime(vol, t);
      gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.02);
    },
    coin() { this.tone(1047, 0, 0.07, 'triangle', 0.14); this.tone(1568, 0.06, 0.16, 'triangle', 0.14); },
    income() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, i * 0.06, 0.12, 'triangle', 0.12)); },
    jump() { this.tone(280, 0, 0.14, 'square', 0.04, 720); },
    stomp() { this.tone(520, 0, 0.1, 'square', 0.05, 140); },
    hit() { this.tone(420, 0, 0.35, 'sawtooth', 0.05, 70); },
    over() { [440, 349, 294, 220].forEach((f, i) => this.tone(f, 0.25 + i * 0.16, 0.18, 'square', 0.04)); },
    click() { this.tone(700, 0, 0.03, 'square', 0.025); },
  };
  window.Sound = Sound;

  // ---------- Money helpers ----------
  function fmt(n, sign = false) {
    const a = Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? '-' : sign && n > 0 ? '+' : '') + state.settings.currency + a;
  }
  function budgetFor(ym) {
    if (state.budgets[ym] != null) return state.budgets[ym];
    const earlier = Object.keys(state.budgets).filter(k => k < ym).sort();
    return earlier.length ? state.budgets[earlier[earlier.length - 1]] : 0;
  }
  function totals(ym) {
    let income = 0, spent = 0;
    const byCat = {};
    for (const t of state.transactions) {
      if (!t.date.startsWith(ym)) continue;
      if (t.type === 'income') income += t.amount;
      else {
        spent += t.amount;
        const k = t.categoryId && catById(t.categoryId) !== OTHER ? t.categoryId : OTHER.id;
        byCat[k] = (byCat[k] || 0) + t.amount;
      }
    }
    return { income, spent, byCat };
  }
  const catById = id => state.categories.find(c => c.id === id) || OTHER;
  const hasShield = () => { const ym = curYM(), b = budgetFor(ym); return b > 0 && totals(ym).spent <= b; };

  // ---------- UI helpers ----------
  let toastTimer = 0;
  function toast(text) {
    const el = $('#toast');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }
  function coinPop(label) {
    const el = document.createElement('div');
    el.className = 'coin-pop';
    const c = document.createElement('canvas');
    window.CoinRun.drawSprite(c, 'coin', 4);
    const s = document.createElement('span');
    s.textContent = label;
    el.append(c, s);
    document.body.append(el);
    setTimeout(() => el.remove(), 1000);
  }
  function txItem(t) {
    const isInc = t.type === 'income';
    const c = isInc ? { emoji: '💰', name: 'Income' } : catById(t.categoryId);
    const title = t.note || c.name;
    return `<li><button class="tx" data-tx="${esc(t.id)}">
      <span class="em">${esc(c.emoji)}</span>
      <span class="main"><span class="name">${esc(title)}</span><span class="meta">${esc(t.note ? c.name + ' · ' : '')}${esc(dayLabel(t.date))}</span></span>
      <span class="amt ${isInc ? 'pos' : 'neg'}">${isInc ? '+' : '-'}${esc(fmt(t.amount))}</span>
    </button></li>`;
  }
  const sortTx = list => list.slice().sort((a, b) => (b.date.localeCompare(a.date)) || (b.id.localeCompare(a.id)));
  const monthTx = ym => sortTx(state.transactions.filter(t => t.date.startsWith(ym)));

  // ---------- Render ----------
  function renderHeader() {
    $('#month-label').textContent = ymLabel(viewMonth);
  }

  function renderWorld() {
    const b = budgetFor(viewMonth);
    const { income, spent, byCat } = totals(viewMonth);
    const left = b - spent;
    const pct = b > 0 ? spent / b : 0;

    $('#level-label').textContent = 'LEVEL ' + ymLabel(viewMonth);
    const coinsEl = $('#coins-left');
    if (b > 0) {
      coinsEl.textContent = fmt(left);
      coinsEl.classList.toggle('neg', left < 0);
      $('#coins-left-label').textContent = left >= 0 ? `left of your ${fmt(b)} budget` : `over your ${fmt(b)} budget`;
      $('#power-text').textContent = `${Math.round(pct * 100)}% of budget used`;
    } else {
      coinsEl.textContent = fmt(income - spent);
      coinsEl.classList.toggle('neg', income - spent < 0);
      $('#coins-left-label').textContent = 'net this month (no budget set)';
      $('#power-text').textContent = '';
    }
    $('#set-budget-btn').hidden = b > 0;
    const bar = $('#power-fill').parentElement;
    bar.hidden = !(b > 0);
    bar.classList.toggle('warn', pct >= 0.75 && pct < 1);
    bar.classList.toggle('danger', pct >= 1);
    $('#power-fill').style.width = Math.min(100, pct * 100) + '%';

    $('#stat-income').textContent = fmt(income);
    $('#stat-spent').textContent = fmt(spent);
    const net = income - spent;
    const netEl = $('#stat-net');
    netEl.textContent = fmt(net, true);
    netEl.className = net >= 0 ? 'pos' : 'neg';

    const banner = $('#over-banner');
    if (b > 0 && left < 0) {
      banner.hidden = false;
      banner.textContent = `GAME OVER? YOU ARE ${fmt(-left)} OVER BUDGET!`;
    } else banner.hidden = true;

    // top categories
    const rows = Object.entries(byCat).sort((a, b2) => b2[1] - a[1]).slice(0, 4);
    $('#world-cats').innerHTML = rows.length ? rows.map(([id, v]) => {
      const c = catById(id);
      const p = c.limit > 0 ? v / c.limit : v / rows[0][1];
      const cls = c.limit > 0 ? (p >= 1 ? 'danger' : p >= 0.75 ? 'warn' : '') : '';
      return `<div class="hbar"><div class="hbar-top"><span>${esc(c.emoji)} ${esc(c.name)}</span><b>${esc(fmt(v))}${c.limit > 0 ? ' / ' + esc(fmt(c.limit)) : ''}</b></div>
        <div class="bar thin ${cls}"><i style="width:${Math.min(100, p * 100)}%"></i></div></div>`;
    }).join('') : '<p class="empty-state">No spending yet. Tap the + block to add an entry.</p>';

    const recent = monthTx(viewMonth).slice(0, 4);
    $('#recent').innerHTML = recent.length ? recent.map(txItem).join('') : '<li class="empty-state">Nothing logged this month.</li>';

    renderGameCard();
  }

  function renderGameCard() {
    const n = state.game.lives;
    const el = $('#lives');
    el.innerHTML = '♥'.repeat(n) + '<span class="empty">' + '♥'.repeat(3 - n) + '</span>';
    el.setAttribute('aria-label', `${n} of 3 lives`);
    const shield = hasShield();
    $('#game-note').textContent = n > 0
      ? `Best: ${state.game.best}${shield ? ' · shield active' : ''}`
      : 'Out of lives. Log an entry to earn one.';
    $('#play-btn').disabled = n <= 0;
  }

  function renderCats() {
    const { byCat } = totals(viewMonth);
    const list = state.categories.map(c => ({ c, v: byCat[c.id] || 0 }));
    if (byCat[OTHER.id]) list.push({ c: OTHER, v: byCat[OTHER.id] });
    $('#cat-list').innerHTML = list.map(({ c, v }) => {
      const p = c.limit > 0 ? v / c.limit : 0;
      const cls = p >= 1 ? 'danger' : p >= 0.75 ? 'warn' : '';
      return `<li><button class="cat ${p >= 1 ? 'over' : ''}" data-cat="${esc(c.id)}" ${c === OTHER ? 'disabled' : ''}>
        <div class="cat-top"><span class="nm">${esc(c.emoji)} ${esc(c.name)}</span>
        <span class="v">${esc(fmt(v))}${c.limit > 0 ? ' / ' + esc(fmt(c.limit)) : ' · no limit'}</span></div>
        ${c.limit > 0 ? `<div class="bar thin ${cls}"><i style="width:${Math.min(100, p * 100)}%"></i></div>` : ''}
      </button></li>`;
    }).join('') || '<li class="empty-state">No categories yet.</li>';
  }

  function renderHistory() {
    const { spent, byCat } = totals(viewMonth);
    const rows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    $('#cat-chart').innerHTML = rows.length ? rows.map(([id, v]) => {
      const c = catById(id);
      return `<div class="hbar"><div class="hbar-top"><span>${esc(c.emoji)} ${esc(c.name)}</span><b>${esc(fmt(v))} · ${Math.round(v / spent * 100)}%</b></div>
        <div class="bar thin"><i style="width:${v / rows[0][1] * 100}%"></i></div></div>`;
    }).join('') : '<p class="empty-state">No spending in ' + esc(ymLabel(viewMonth)) + '.</p>';

    $('#month-chart').innerHTML = monthChart();

    const tx = monthTx(viewMonth);
    let html = '', lastDay = '';
    for (const t of tx) {
      if (t.date !== lastDay) { lastDay = t.date; html += `<li class="day-head px">${esc(dayLabel(t.date).toUpperCase())}</li>`; }
      html += txItem(t);
    }
    $('#tx-list').innerHTML = html || '<li class="empty-state">No entries in ' + esc(ymLabel(viewMonth)) + '.</li>';
  }

  function monthChart() {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftYM(viewMonth, -i));
    const data = months.map(m => ({ m, ...totals(m), budget: budgetFor(m) }));
    const max = Math.max(1, ...data.map(d => Math.max(d.income, d.spent)));
    const W = 300, base = 124, top = 18, ch = base - top, colW = W / 6, bw = 14;
    let s = `<svg viewBox="0 0 ${W} 146" class="chart" role="img" aria-label="Income and spending for the last 6 months" shape-rendering="crispEdges">`;
    s += `<text x="0" y="8" class="lbl">${esc(fmt(max))}</text>`;
    s += `<line x1="0" x2="${W}" y1="${base}" y2="${base}" class="axis"/>`;
    data.forEach((d, i) => {
      const cx = Math.round(i * colW + colW / 2);
      const hi = Math.round(d.income / max * ch), hs = Math.round(d.spent / max * ch);
      if (hi) s += `<rect x="${cx - bw - 1}" y="${base - hi}" width="${bw}" height="${hi}" class="b-inc"><title>${esc(ymLabel(d.m))} income ${esc(fmt(d.income))}</title></rect>`;
      if (hs) s += `<rect x="${cx + 1}" y="${base - hs}" width="${bw}" height="${hs}" class="b-exp ${d.budget > 0 && d.spent > d.budget ? 'over' : ''}"><title>${esc(ymLabel(d.m))} spent ${esc(fmt(d.spent))}</title></rect>`;
      s += `<text x="${cx}" y="${base + 16}" text-anchor="middle" class="lbl ${d.m === viewMonth ? 'cur' : ''}">${esc(ymLabel(d.m, true))}</text>`;
    });
    return s + '</svg>';
  }

  function renderSettings() {
    $('#budget-label').textContent = 'Budget for ' + ymLabel(viewMonth);
    const b = budgetFor(viewMonth);
    if (document.activeElement !== $('#budget-input')) $('#budget-input').value = b > 0 ? String(b) : '';
    if (document.activeElement !== $('#currency-input')) $('#currency-input').value = state.settings.currency;
    $('#sound-input').checked = state.settings.sound;
  }

  function renderAll() {
    renderHeader(); renderWorld(); renderCats(); renderHistory(); renderSettings();
  }

  // ---------- Navigation ----------
  function showScreen(name) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    $$('.tab[data-screen]').forEach(t => t.classList.toggle('active', t.dataset.screen === name));
    window.scrollTo(0, 0);
  }
  $$('.tab[data-screen]').forEach(t => t.addEventListener('click', () => { Sound.click(); showScreen(t.dataset.screen); }));
  $('#prev-month').addEventListener('click', () => { viewMonth = shiftYM(viewMonth, -1); renderAll(); });
  $('#next-month').addEventListener('click', () => { viewMonth = shiftYM(viewMonth, 1); renderAll(); });
  $('#month-label').addEventListener('click', () => { viewMonth = curYM(); renderAll(); });

  // ---------- Dialogs ----------
  $$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
  $$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  // Transaction dialog
  const txDlg = $('#tx-dialog'), txForm = $('#tx-form');
  function fillCatSelect(selected) {
    const sel = txForm.elements.category;
    sel.innerHTML = state.categories.map(c => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.name)}</option>`).join('') +
      `<option value="">${OTHER.emoji} ${OTHER.name}</option>`;
    sel.value = selected != null && (selected === '' || state.categories.some(c => c.id === selected)) ? selected : (state.categories[0] ? state.categories[0].id : '');
  }
  function syncTypeUI() {
    $('#tx-cat-field').hidden = txForm.elements.type.value === 'income';
  }
  function openTx(t) {
    txForm.reset();
    $('#tx-error').hidden = true;
    const editing = !!t;
    $('#tx-title').textContent = editing ? 'EDIT ENTRY' : 'NEW ENTRY';
    $('#tx-delete').hidden = !editing;
    txForm.elements.id.value = editing ? t.id : '';
    txForm.elements.type.value = editing ? t.type : 'expense';
    txForm.elements.amount.value = editing ? String(t.amount) : '';
    txForm.elements.note.value = editing ? t.note : '';
    txForm.elements.date.value = editing ? t.date : (viewMonth === curYM() ? todayStr() : viewMonth + '-01');
    fillCatSelect(editing ? (t.categoryId && catById(t.categoryId) !== OTHER ? t.categoryId : '') : null);
    syncTypeUI();
    txDlg.showModal();
    if (!editing) setTimeout(() => txForm.elements.amount.focus(), 50);
  }
  $$('input[name="type"]', txForm).forEach(r => r.addEventListener('change', syncTypeUI));
  txForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = txForm.elements;
    const amount = parseAmount(f.amount.value);
    const err = $('#tx-error');
    if (!(amount > 0)) { err.textContent = 'Enter an amount above zero.'; err.hidden = false; f.amount.focus(); return; }
    if (!isDate(f.date.value)) { err.textContent = 'Pick a date.'; err.hidden = false; return; }
    const type = f.type.value === 'income' ? 'income' : 'expense';
    const data = { type, amount, categoryId: type === 'expense' ? (f.category.value || null) : null, note: f.note.value.trim().slice(0, 60), date: f.date.value };
    const id = f.id.value;
    if (id) {
      const t = state.transactions.find(x => x.id === id);
      if (t) Object.assign(t, data);
      toast('Entry updated');
    } else {
      state.transactions.push({ id: uid(), ...data });
      const gained = state.game.lives < 3;
      if (gained) state.game.lives++;
      type === 'income' ? Sound.income() : Sound.coin();
      coinPop(gained ? '1-UP!' : (type === 'income' ? '+' : '-') + fmt(amount));
      if (gained) toast('+1 LIFE FOR COIN RUN');
    }
    save();
    txDlg.close();
    viewMonth = data.date.slice(0, 7);
    renderAll();
  });
  $('#tx-delete').addEventListener('click', () => {
    const id = txForm.elements.id.value;
    if (!id || !confirm('Delete this entry?')) return;
    state.transactions = state.transactions.filter(t => t.id !== id);
    save(); txDlg.close(); renderAll(); toast('Entry deleted');
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tx]');
    if (!b) return;
    const t = state.transactions.find(x => x.id === b.dataset.tx);
    if (t) openTx(t);
  });
  $('#add-btn').addEventListener('click', () => {
    const btn = $('#add-btn');
    btn.classList.remove('bump'); void btn.offsetWidth; btn.classList.add('bump');
    Sound.click();
    openTx(null);
  });

  // Category dialog
  const catDlg = $('#cat-dialog'), catForm = $('#cat-form');
  $('#emoji-picks').innerHTML = EMOJIS.map(e => `<button type="button" data-emoji="${e}" aria-label="Use ${e}">${e}</button>`).join('');
  $('#emoji-picks').addEventListener('click', e => {
    const b = e.target.closest('[data-emoji]');
    if (b) catForm.elements.emoji.value = b.dataset.emoji;
  });
  function openCat(c) {
    catForm.reset();
    $('#cat-error').hidden = true;
    $('#cat-title').textContent = c ? 'EDIT CATEGORY' : 'NEW CATEGORY';
    $('#cat-delete').hidden = !c;
    catForm.elements.id.value = c ? c.id : '';
    catForm.elements.name.value = c ? c.name : '';
    catForm.elements.emoji.value = c ? c.emoji : '⭐';
    catForm.elements.limit.value = c && c.limit ? String(c.limit) : '';
    catDlg.showModal();
  }
  $('#new-cat-btn').addEventListener('click', () => openCat(null));
  $('#cat-list').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    const c = state.categories.find(x => x.id === b.dataset.cat);
    if (c) openCat(c);
  });
  catForm.addEventListener('submit', e => {
    e.preventDefault();
    const f = catForm.elements;
    const name = f.name.value.trim();
    const err = $('#cat-error');
    if (!name) { err.textContent = 'Give it a name.'; err.hidden = false; f.name.focus(); return; }
    const limitRaw = f.limit.value.trim();
    const limit = limitRaw ? parseAmount(limitRaw) : 0;
    if (!(limit >= 0)) { err.textContent = 'The limit must be a number.'; err.hidden = false; return; }
    const data = { name: name.slice(0, 24), emoji: (f.emoji.value.trim() || '⭐').slice(0, 8), limit };
    if (f.id.value) {
      const c = state.categories.find(x => x.id === f.id.value);
      if (c) Object.assign(c, data);
    } else state.categories.push({ id: uid(), ...data });
    save(); catDlg.close(); renderAll(); Sound.coin();
  });
  $('#cat-delete').addEventListener('click', () => {
    const id = catForm.elements.id.value;
    const c = state.categories.find(x => x.id === id);
    if (!c || !confirm(`Delete "${c.name}"? Its entries move to Other.`)) return;
    state.categories = state.categories.filter(x => x.id !== id);
    state.transactions.forEach(t => { if (t.categoryId === id) t.categoryId = null; });
    save(); catDlg.close(); renderAll(); toast('Category deleted');
  });

  // ---------- Settings ----------
  $('#set-budget-btn').addEventListener('click', () => { showScreen('settings'); $('#budget-input').focus(); });
  $('#budget-form').addEventListener('submit', e => {
    e.preventDefault();
    const raw = $('#budget-input').value.trim();
    const v = raw ? parseAmount(raw) : 0;
    if (!(v >= 0)) { toast('Enter a number'); return; }
    state.budgets[viewMonth] = v;
    save(); $('#budget-input').blur(); renderAll();
    Sound.coin(); toast(v > 0 ? 'Budget saved for ' + ymLabel(viewMonth) : 'Budget cleared');
  });
  $('#currency-input').addEventListener('input', e => {
    state.settings.currency = e.target.value.slice(0, 4);
    save(); renderWorld(); renderCats(); renderHistory();
  });
  $('#sound-input').addEventListener('change', e => {
    state.settings.sound = e.target.checked;
    save();
    if (e.target.checked) Sound.coin();
  });

  $('#export-btn').addEventListener('click', async () => {
    const json = JSON.stringify(state, null, 2);
    const name = `coin-quest-backup-${todayStr()}.json`;
    try {
      const file = new File([json], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Coin Quest backup' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup downloaded');
  });
  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async e => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!data || !Array.isArray(data.transactions)) throw new Error('bad');
      if (!confirm('Replace all current data with this backup?')) return;
      state = normalize(data);
      save(); renderAll(); toast('Backup loaded');
    } catch (err) {
      toast('That file is not a Coin Quest backup');
    }
  });
  $('#reset-btn').addEventListener('click', () => {
    if (!confirm('Erase ALL entries, categories and budgets? This cannot be undone.')) return;
    state = freshState();
    viewMonth = curYM();
    save(); renderAll(); showScreen('world'); toast('Fresh start!');
  });

  // ---------- Mini game ----------
  $('#play-btn').addEventListener('click', () => {
    if (state.game.lives <= 0) { toast('Log an entry to earn a life'); return; }
    window.CoinRun.open({
      lives: () => state.game.lives,
      best: () => state.game.best,
      shield: hasShield,
      canStart: () => state.game.lives > 0,
      onStart: () => { state.game.lives = Math.max(0, state.game.lives - 1); save(); },
      onEnd: score => { if (score > state.game.best) state.game.best = score; save(); return state.game.best; },
      onClose: () => renderGameCard(),
    });
  });

  // ---------- Boot ----------
  window.CoinRun.drawSprite($('#mascot'), 'pigA', 4);
  window.CoinRun.drawSprite($('#scene-coin'), 'coin', 3);
  renderAll();

  // Refresh "today" if the app stays open past midnight / month end
  document.addEventListener('visibilitychange', () => { if (!document.hidden) renderAll(); });

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
