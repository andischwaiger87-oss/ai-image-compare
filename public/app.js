/* KI-Bildvergleich – mosaik
 * Daten: /data/gallery.json
 * Bilder: /images/<prompt-id>/<model-id>.webp  (+ <model-id>-sm.webp als Vorschau)
 */
(() => {
  'use strict';

  const view = document.getElementById('view');
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCap = document.getElementById('lb-cap');

  const state = { data: null, models: new Map(), mode: 'grid', pair: null, lbList: [], lbIndex: 0, filter: 'all' };

  const fmtMonth = new Intl.DateTimeFormat('de-AT', { month: 'long', year: 'numeric' });
  const fmtDay = new Intl.DateTimeFormat('de-AT', { day: 'numeric', month: 'long', year: 'numeric' });

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const src = (pid, mid, small) => `/images/${pid}/${mid}${small ? '-sm' : ''}.webp`;
  const modelLabel = (m) => [m.name, m.version].filter(Boolean).join(' ');
  const year = (m) => new Date(m.date).getFullYear();
  const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // Modelle eines Prompts in der globalen Reihenfolge (chronologisch, wie in gallery.json)
  const modelsOf = (p) => state.data.models.filter((m) => p.images.includes(m.id));

  // Alle Plätze eines Prompts: vorhandene Bilder + aktuelle Modelle ohne Bild (verweigert/fehlt)
  const slotsOf = (p) => state.data.models
    .filter((m) => p.images.includes(m.id) || m.current)
    .map((m) => ({ m, has: p.images.includes(m.id), refused: (p.refused || []).includes(m.id), note: (p.notes || {})[m.id] }));

  // Ältestes Bild eines Prompts (z. B. Midjourney V3/V4/V5)
  const originOf = (p) => modelsOf(p).find((m) => !m.current);

  // ---------- compare slider ----------
  function compare(p, leftId, rightId, { hero = false } = {}) {
    const L = state.models.get(leftId), R = state.models.get(rightId);
    const el = h(`
      <div class="cmp${hero ? ' cmp--hero' : ''}" style="--pos:50%">
        <img class="cmp-img cmp-a" src="${src(p.id, L.id)}" alt="${esc(modelLabel(L))}: ${esc(p.title)}" draggable="false">
        <img class="cmp-img cmp-b" src="${src(p.id, R.id)}" alt="${esc(modelLabel(R))}: ${esc(p.title)}" draggable="false">
        <span class="cmp-tag cmp-tag--a" style="--c:${L.color}">${esc(modelLabel(L))}<small>${year(L)}</small></span>
        <span class="cmp-tag cmp-tag--b" style="--c:${R.color}">${esc(modelLabel(R))}<small>${year(R)}</small></span>
        <div class="cmp-handle" aria-hidden="true"><span></span></div>
        <input class="cmp-range" type="range" min="0" max="100" value="50" step="0.5"
          aria-label="Vergleich: ${esc(modelLabel(L))} links, ${esc(modelLabel(R))} rechts">
      </div>`);
    const range = el.querySelector('.cmp-range');
    const set = (v) => { v = Math.max(0, Math.min(100, v)); el.style.setProperty('--pos', v + '%'); range.value = v; };
    const fromEvent = (e) => { const r = el.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
    let dragging = false;
    el.addEventListener('pointerdown', (e) => { dragging = true; el.setPointerCapture(e.pointerId); el.classList.add('is-drag'); fromEvent(e); });
    el.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    const stop = () => { dragging = false; el.classList.remove('is-drag'); };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointercancel', stop);
    range.addEventListener('input', () => set(+range.value));
    if (hero) {
      // kleine Einladung zum Ziehen
      requestAnimationFrame(() => el.classList.add('is-intro'));
      el.addEventListener('animationend', () => el.classList.remove('is-intro'), { once: true });
    }
    return el;
  }

  // ---------- views ----------
  function home() {
    const { data } = state;
    const total = data.prompts.reduce((n, p) => n + p.images.length, 0);
    const first = data.models[0], last = data.models[data.models.length - 1];
    const span = year(last) - year(first);
    const hero = data.prompts.find((p) => p.images.includes('mj-v4') && p.images.includes('mj-v8-2')) || data.prompts[0];
    const heroModels = modelsOf(hero);

    const el = h(`
      <div class="home">
        <section class="hero">
          <div class="hero-text">
            <p class="eyebrow">${esc(modelLabel(first))} · ${esc(fmtMonth.format(new Date(first.date)))} → heute</p>
            <h1>${esc(data.title).replace(/([^.]+\.)\s*$/, '<span class="grad">$1</span>')}</h1>
            <p class="lead">${esc(data.intro)}</p>
            <dl class="stats">
              <div><dt>Prompts</dt><dd>${data.prompts.length}</dd></div>
              <div><dt>Modelle</dt><dd>${data.models.length}</dd></div>
              <div><dt>Bilder</dt><dd>${total}</dd></div>
              <div><dt>Jahre</dt><dd>${span}</dd></div>
            </dl>
            <a class="btn" href="#/p/${esc(hero.id)}">Vergleich ansehen <span aria-hidden="true">→</span></a>
          </div>
          <div class="hero-visual">
            <div class="hero-cmp"></div>
            <p class="hint"><span aria-hidden="true">↔</span> Ziehen zum Vergleichen · „${esc(hero.title)}“</p>
          </div>
        </section>

        <section class="timeline" aria-label="Modelle">
          ${data.models.map((m) => `
            <div class="tl-item" style="--c:${m.color}">
              <span class="tl-dot"></span>
              <span class="tl-date">${esc(fmtMonth.format(new Date(m.date)))}</span>
              <strong>${esc(modelLabel(m))}</strong>
              <span class="tl-maker">${esc(m.maker)}</span>
            </div>`).join('')}
        </section>

        <section class="prompts" aria-labelledby="prompts-h">
          <div class="section-head">
            <h2 id="prompts-h">Die Prompts</h2>
            <p>Jede Karte ein Prompt, jede Kachel ein Modell.</p>
          </div>
          ${filters()}
          <ol class="cards">
            ${data.prompts.map((p, i) => card(p, i)).join('')}
          </ol>
        </section>
      </div>`);

    el.querySelector('.hero-cmp').append(compare(hero, heroModels[0].id, heroModels[1].id, { hero: true }));

    const chips = el.querySelector('.chips');
    if (chips) chips.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.filter = b.dataset.f;
      chips.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b));
      applyFilter(el);
    });
    applyFilter(el);
    return el;
  }

  function filters() {
    const { data } = state;
    const origins = data.models.filter((m) => !m.current)
      .map((m) => ({ m, n: data.prompts.filter((p) => originOf(p)?.id === m.id).length }))
      .filter((x) => x.n);
    if (origins.length < 2) return '';
    const f = state.filter || 'all';
    return `<div class="chips" role="group" aria-label="Nach Ausgangsmodell filtern">
      <span class="chips-label">Ausgangsbild</span>
      <button type="button" data-f="all" aria-pressed="${f === 'all'}">Alle <small>${data.prompts.length}</small></button>
      ${origins.map(({ m, n }) => `<button type="button" data-f="${m.id}" aria-pressed="${f === m.id}" style="--c:${m.color}">${esc(modelLabel(m))} <small>${n}</small></button>`).join('')}
    </div>`;
  }

  function applyFilter(root) {
    const f = state.filter || 'all';
    root.querySelectorAll('.cards > li').forEach((li) => { li.hidden = f !== 'all' && li.dataset.origin !== f; });
  }

  function card(p, i) {
    const origin = originOf(p);
    const cells = slotsOf(p).slice(0, 4).map(({ m, has, refused }) => has
      ? `<span class="tile"><img src="${src(p.id, m.id, true)}" alt="" loading="lazy" decoding="async"><b style="--c:${m.color}">${esc(modelLabel(m))}</b></span>`
      : `<span class="tile tile--empty"><b>${esc(modelLabel(m))}</b><em>${refused ? 'verweigert' : 'kein Bild'}</em></span>`).join('');
    return `
      <li data-origin="${origin ? origin.id : ''}">
        <a class="card" href="#/p/${esc(p.id)}">
          <span class="card-mosaic">${cells}</span>
          <span class="card-body">
            <span class="num">${pad(i + 1)}</span>
            <span class="card-title">${esc(p.title)}</span>
            <span class="card-prompt">${esc(p.prompt)}</span>
          </span>
        </a>
      </li>`;
  }

  function detail(id) {
    const { data } = state;
    const i = data.prompts.findIndex((p) => p.id === id);
    if (i < 0) return notFound();
    const p = data.prompts[i];
    const ms = modelsOf(p);
    const prev = data.prompts[(i - 1 + data.prompts.length) % data.prompts.length];
    const next = data.prompts[(i + 1) % data.prompts.length];

    // Standardpaar: die ersten beiden Modelle (Midjourney V4 vs. V8.2)
    if (!state.pair || state.pair.pid !== p.id) {
      state.pair = { pid: p.id, a: ms[0].id, b: (ms[1] || ms[0]).id };
    }

    const el = h(`
      <article class="detail">
        <nav class="crumbs"><a href="#/">← Übersicht</a><span>${pad(i + 1)} / ${pad(data.prompts.length)}</span></nav>
        <header class="detail-head">
          <h1>${esc(p.title)}</h1>
          <div class="prompt">
            <span class="prompt-label">Prompt</span>
            <p class="prompt-text">${esc(p.prompt)}</p>
            <button class="copy" type="button">Kopieren</button>
          </div>
        </header>

        <div class="toolbar">
          <div class="seg" role="tablist" aria-label="Ansicht">
            <button role="tab" data-mode="grid" aria-selected="${state.mode === 'grid'}">Nebeneinander</button>
            <button role="tab" data-mode="compare" aria-selected="${state.mode === 'compare'}">Vergleich</button>
          </div>
          <div class="pickers" ${state.mode === 'compare' ? '' : 'hidden'}>
            <label><span>Links</span><select data-side="a">${opts(ms, state.pair.a)}</select></label>
            <span class="vs">vs</span>
            <label><span>Rechts</span><select data-side="b">${opts(ms, state.pair.b)}</select></label>
          </div>
        </div>

        <div class="stage"></div>

        <nav class="pager" aria-label="Weitere Prompts">
          <a href="#/p/${esc(prev.id)}" class="pager-prev"><small>← Vorheriger</small><span>${esc(prev.title)}</span></a>
          <a href="#/p/${esc(next.id)}" class="pager-next"><small>Nächster →</small><span>${esc(next.title)}</span></a>
        </nav>
      </article>`);

    const stage = el.querySelector('.stage');
    const pickers = el.querySelector('.pickers');

    const render = () => {
      stage.replaceChildren(state.mode === 'grid' ? grid(p, ms) : compare(p, state.pair.a, state.pair.b));
      pickers.hidden = state.mode !== 'compare';
      el.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-selected', b.dataset.mode === state.mode));
    };

    el.querySelector('.seg').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state.mode = b.dataset.mode; render();
    });
    pickers.addEventListener('change', (e) => {
      state.pair[e.target.dataset.side] = e.target.value; render();
    });
    el.querySelector('.copy').addEventListener('click', async (e) => {
      try { await navigator.clipboard.writeText(p.prompt); e.target.textContent = 'Kopiert ✓'; }
      catch { e.target.textContent = 'Nicht möglich'; }
      setTimeout(() => (e.target.textContent = 'Kopieren'), 1800);
    });

    render();
    return el;
  }

  const opts = (ms, sel) => ms.map((m) => `<option value="${m.id}" ${m.id === sel ? 'selected' : ''}>${esc(modelLabel(m))}</option>`).join('');

  function grid(p, ms) {
    const slots = slotsOf(p);
    const el = h(`<div class="grid" style="--n:${slots.length}"></div>`);
    slots.forEach(({ m, has, refused, note }) => {
      if (!has) {
        el.append(h(`
          <figure class="shot shot--empty" style="--c:${m.color}">
            <div class="shot-btn shot-empty"><span>${refused ? 'Anfrage vom Modell verweigert' : 'Kein Bild vorhanden'}</span></div>
            <figcaption>
              <strong>${esc(modelLabel(m))}</strong>
              <span>${esc(m.maker)}</span>
            </figcaption>
          </figure>`));
        return;
      }
      const idx = ms.indexOf(m);
      const fig = h(`
        <figure class="shot" style="--c:${m.color}">
          <button type="button" class="shot-btn" aria-label="${esc(modelLabel(m))} groß ansehen">
            <img src="${src(p.id, m.id, true)}" srcset="${src(p.id, m.id, true)} 640w, ${src(p.id, m.id)} 1600w"
              sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 25vw" alt="${esc(modelLabel(m))}: ${esc(p.title)}" loading="lazy" decoding="async">
          </button>
          <figcaption>
            <strong>${esc(modelLabel(m))}</strong>
            <span>${esc(m.maker)} · ${esc(fmtMonth.format(new Date(m.date)))}</span>
            ${note ? `<em class="note">ⓘ ${esc(note)}</em>` : ''}
          </figcaption>
        </figure>`);
      fig.querySelector('button').addEventListener('click', () => openLb(ms.map((x) => ({ p, m: x })), idx));
      el.append(fig);
    });
    return el;
  }

  function about() {
    const { data } = state;
    return h(`
      <article class="about">
        <nav class="crumbs"><a href="#/">← Übersicht</a></nav>
        <h1>Methode</h1>
        <p class="lead">Ein fairer Vergleich braucht feste Regeln. Diese hier.</p>
        <ol class="rules">
          <li><strong>Gleicher Prompt.</strong> Der ursprüngliche Text aus 2022/2023 wird wortgleich übernommen. Auch Tippfehler und Midjourney-Gewichtungen wie <code>::1</code> bleiben drin.</li>
          <li><strong>Ein Durchgang.</strong> Pro Modell ein Ergebnis. Kein Nachschärfen, kein zweiter Versuch mit besserem Prompt.</li>
          <li><strong>Verweigert bleibt verweigert.</strong> Lehnt ein Modell die Anfrage ab, steht das so in der Übersicht. Es wird nicht umformuliert, bis es klappt.</li>
          <li><strong>Keine Nachbearbeitung.</strong> Gezeigt wird, was das Modell geliefert hat. Für das Web nur verkleinert und als WebP gespeichert.</li>
        </ol>
        <h2>Modelle</h2>
        <table class="models">
          <thead><tr><th>Modell</th><th>Anbieter</th><th>Datum</th></tr></thead>
          <tbody>
            ${data.models.map((m) => `<tr><td><span class="dot" style="--c:${m.color}"></span>${esc(modelLabel(m))}</td><td>${esc(m.maker)}</td><td>${esc(fmtDay.format(new Date(m.date)))}</td></tr>`).join('')}
          </tbody>
        </table>
      </article>`);
  }

  function notFound() {
    return h(`<div class="empty"><h1>Nicht gefunden</h1><p><a href="#/">Zur Übersicht</a></p></div>`);
  }

  // ---------- lightbox ----------
  function openLb(list, i) {
    state.lbList = list; state.lbIndex = i; showLb();
    if (!lb.open) lb.showModal();
  }
  function showLb() {
    const { p, m } = state.lbList[state.lbIndex];
    lbImg.src = src(p.id, m.id);
    lbImg.alt = `${modelLabel(m)}: ${p.title}`;
    lbCap.innerHTML = `<strong style="--c:${m.color}">${esc(modelLabel(m))}</strong> ${esc(m.maker)} · ${esc(fmtMonth.format(new Date(m.date)))} <span>${state.lbIndex + 1} / ${state.lbList.length}</span>`;
  }
  const stepLb = (d) => { const n = state.lbList.length; state.lbIndex = (state.lbIndex + d + n) % n; showLb(); };
  lb.addEventListener('click', (e) => {
    const a = e.target.closest('[data-lb]')?.dataset.lb;
    if (a === 'close' || e.target === lb) lb.close();
    else if (a === 'prev') stepLb(-1);
    else if (a === 'next') stepLb(1);
  });
  lb.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') stepLb(-1);
    if (e.key === 'ArrowRight') stepLb(1);
  });
  let tx = null;
  lb.addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', (e) => {
    if (tx === null) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) stepLb(dx < 0 ? 1 : -1);
  });

  // ---------- router ----------
  function route() {
    if (lb.open) lb.close();
    const hash = location.hash.replace(/^#\/?/, '');
    const [a, b] = hash.split('/');
    let node, title = 'KI-Bildvergleich | mosaik';
    if (a === 'p' && b) { node = detail(decodeURIComponent(b)); const p = state.data.prompts.find((x) => x.id === b); if (p) title = `${p.title} – KI-Bildvergleich | mosaik`; }
    else if (a === 'about') { node = about(); title = 'Methode – KI-Bildvergleich | mosaik'; }
    else node = home();
    document.title = title;
    view.replaceChildren(node);
    document.querySelectorAll('.topnav a').forEach((l) => l.toggleAttribute('aria-current', l.getAttribute('href') === '#/' + (a === 'about' ? 'about' : '')));
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  fetch('/data/gallery.json', { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      state.data = data;
      data.models.forEach((m) => state.models.set(m.id, m));
      window.addEventListener('hashchange', route);
      route();
    })
    .catch((err) => {
      view.innerHTML = `<div class="empty"><h1>Daten konnten nicht geladen werden</h1><p>${esc(err.message)}</p></div>`;
    });
})();
