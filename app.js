/* Recovery Habit – PWA (vanilla JS, lokálne dáta) */
(() => {
  "use strict";

  /* ---------- Konštanty ---------- */
  const STORAGE_KEY = "recovery-habit:v1";
  const DAYS_SHORT = ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"];
  const DAYS_LONG = ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"];
  const MONTHS = ["január", "február", "marec", "apríl", "máj", "jún", "júl", "august", "september", "október", "november", "december"];
  const MONTHS_NOM = ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"];
  const EMOJIS = ["✅", "💧", "🏋️", "📖", "⏰", "🚫", "🇬🇧", "🌙", "🧘", "🚶", "🥗", "💊", "📓", "☀️", "🙏", "🧹", "💰", "📵", "🎯", "❤️"];
  const COLORS = { teal: "#0f766e", blue: "#2563eb", violet: "#7c3aed", rose: "#e11d48", amber: "#d97706", green: "#16a34a", orange: "#ea580c", slate: "#475569" };
  const QUOTES = [
    "Každý deň je nový začiatok.",
    "Nemusíš byť dokonalý. Stačí byť dnes o kúsok lepší.",
    "Disciplína je most medzi cieľmi a výsledkami.",
    "Malé kroky každý deň vedú k veľkým zmenám.",
    "Neprerušuj sériu. Jeden deň po druhom.",
    "Si to, čo robíš opakovane.",
    "Pokrok, nie dokonalosť.",
    "Najťažší je prvý krok. Už si ho urobil.",
    "Dnes robíš niečo pre toho, kým budeš zajtra.",
    "Konzistentnosť porazí intenzitu.",
  ];

  /* ---------- Pomocné ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => toStr(new Date());
  const fromStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); };
  const dow = (s) => fromStr(s).getDay();
  const fmtLong = (s) => { const d = fromStr(s); return `${DAYS_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`; };
  const fmtShort = (s) => { const d = fromStr(s); return `${d.getDate()}. ${d.getMonth() + 1}.`; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const relDay = (s) => { const t = todayStr(); if (s === t) return "Dnes"; if (s === addDays(t, -1)) return "Včera"; if (s === addDays(t, 1)) return "Zajtra"; return fmtLong(s); };
  const quoteOfDay = () => QUOTES[fromStr(todayStr()).getTime() / 864e5 % QUOTES.length | 0];
  const soft = (hex) => hex + "26"; // ~15 % alpha
  const greeting = () => { const h = new Date().getHours(); return h < 5 ? "Ešte hore?" : h < 10 ? "Dobré ráno" : h < 18 ? "Pekný deň" : "Dobrý večer"; };

  /* ---------- Stav ---------- */
  const defaultState = () => ({
    version: 1,
    profile: { name: "", avatar: "🌱" },
    settings: { notifications: true, theme: "auto", season: "auto", installDismissed: false, onboarded: false },
    habits: [],
    oneOffs: [],
    logs: {}, // { "YYYY-MM-DD": { habitId: true } }
    createdAt: new Date().toISOString(),
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return Object.assign(defaultState(), parsed, { settings: Object.assign(defaultState().settings, parsed.settings || {}), profile: Object.assign({ name: "", avatar: "🌱" }, parsed.profile || {}), oneOffs: Array.isArray(parsed.oneOffs) ? parsed.oneOffs : [] });
    } catch {
      return defaultState();
    }
  }
  let state = load();
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      toast({ kind: "error", title: "Nepodarilo sa uložiť", body: "Úložisko prehliadača je plné alebo blokované." });
    }
  }

  /* ---------- Doména ---------- */
  const isScheduled = (h, date) => !h.archived && date >= h.startDate && h.days.includes(dow(date));
  const habitsFor = (date) => state.habits.filter((h) => isScheduled(h, date));
  const isDone = (h, date) => !!(state.logs[date] && state.logs[date][h.id]);
  function setDone(h, date, val) {
    if (!state.logs[date]) state.logs[date] = {};
    if (val) state.logs[date][h.id] = true;
    else delete state.logs[date][h.id];
    if (!Object.keys(state.logs[date]).length) delete state.logs[date];
    save();
  }
  function dayStats(date) {
    const hs = habitsFor(date);
    const done = hs.filter((h) => isDone(h, date)).length;
    return { total: hs.length, done, pct: hs.length ? Math.round((done / hs.length) * 100) : null };
  }
  function streak(h, end = todayStr()) {
    let cursor = end;
    if (isScheduled(h, cursor) && !isDone(h, cursor)) cursor = addDays(cursor, -1);
    let n = 0;
    for (let i = 0; i < 1000 && cursor >= h.startDate; i++) {
      if (isScheduled(h, cursor)) {
        if (isDone(h, cursor)) n++;
        else break;
      }
      cursor = addDays(cursor, -1);
    }
    return n;
  }
  function bestStreak(h) {
    let best = 0, run = 0;
    const t = todayStr();
    for (let d = h.startDate; d <= t; d = addDays(d, 1)) {
      if (!isScheduled(h, d)) continue;
      if (isDone(h, d)) { run++; best = Math.max(best, run); } else if (d !== t) run = 0;
    }
    return best;
  }
  function rate(h, days = 30) {
    const t = todayStr();
    let sched = 0, done = 0;
    for (let i = 0; i < days; i++) {
      const d = addDays(t, -i);
      if (d < h.startDate) break;
      if (!isScheduled(h, d)) continue;
      sched++;
      if (isDone(h, d)) done++;
    }
    return sched ? Math.round((done / sched) * 100) : null;
  }
  function perfectStreak() {
    let cursor = todayStr();
    const ts = dayStats(cursor);
    if (ts.total && ts.done < ts.total) cursor = addDays(cursor, -1);
    let n = 0;
    for (let i = 0; i < 1000; i++) {
      const s = dayStats(cursor);
      if (s.total === 0) { if (n === 0 && i > 60) break; if (i > 365) break; cursor = addDays(cursor, -1); continue; }
      if (s.done === s.total) n++;
      else break;
      cursor = addDays(cursor, -1);
    }
    return n;
  }
  function totalCompletions() {
    return Object.values(state.logs).reduce((s, day) => s + Object.keys(day).length, 0);
  }

  /* ---------- Toasty ---------- */
  function toast({ kind = "info", title, body, ms }) {
    const el = document.createElement("div");
    el.className = `toast ${kind}`;
    const ico = kind === "error" ? "!" : kind === "reminder" ? "⏰" : kind === "success" ? "✓" : "i";
    el.innerHTML = `<div class="t-ico">${ico}</div><div><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ""}</div>`;
    $("#toasts").appendChild(el);
    el.addEventListener("click", () => el.remove());
    setTimeout(() => el.remove(), ms || (kind === "reminder" ? 12000 : 3200));
  }

  /* ---------- Sheet (modal) ---------- */
  function sheet(html, onMount) {
    const root = $("#modal-root");
    root.innerHTML = `<div class="sheet-bg" data-close><div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div></div>`;
    const bg = root.firstElementChild;
    bg.addEventListener("click", (e) => { if (e.target === bg) closeSheet(); });
    if (onMount) onMount(bg);
  }
  function closeSheet() { $("#modal-root").innerHTML = ""; }
  function confirmSheet({ title, body, ok = "Potvrdiť", danger = false }) {
    return new Promise((resolve) => {
      sheet(`<h3>${esc(title)}</h3><p class="sub">${esc(body)}</p><div class="btn-row"><button class="btn secondary" data-no>Zrušiť</button><button class="btn ${danger ? "danger" : ""}" data-yes>${esc(ok)}</button></div>`, (el) => {
        $("[data-no]", el).onclick = () => { closeSheet(); resolve(false); };
        $("[data-yes]", el).onclick = () => { closeSheet(); resolve(true); };
      });
    });
  }

  /* ---------- Router ---------- */
  function route() {
    const hash = location.hash || "#/home";
    const [, path = "home", arg = "", arg2 = ""] = hash.split("/");
    return { path, arg: decodeURIComponent(arg), arg2 };
  }
  const go = (h) => { location.hash = h; };
  window.addEventListener("hashchange", render);

  function setTab(name) {
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
  }

  function render() {
    const { path, arg } = route();
    const app = $("#app");
    app.scrollTop = 0;
    window.scrollTo(0, 0);
    switch (path) {
      case "home": setTab("home"); return renderHome(app, /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : todayStr());
      case "add": setTab("add"); return renderForm(app, null);
      case "edit": setTab("home"); return renderForm(app, state.habits.find((h) => h.id === arg) || null);
      case "calendar": setTab("calendar"); return renderCalendar(app, arg);
      case "stats": setTab("stats"); return renderStats(app);
      case "settings": setTab("settings"); return renderSettings(app);
      case "backup": setTab("settings"); return renderBackup(app);
      case "share": setTab("add"); return renderShareImport(app, arg);
      default: return go("#/home");
    }
  }

  /* ---------- Domov ---------- */
  function renderHome(app, date) {
    const t = todayStr();
    const isToday = date === t;
    const s = dayStats(date);
    const hs = habitsFor(date);
    const name = state.profile.name ? `, ${state.profile.name.split(" ")[0]}` : "";
    const future = date > t;

    const groups = [["Ráno", (h) => h.reminderTime && h.reminderTime < "12:00"], ["Poobede", (h) => h.reminderTime && h.reminderTime >= "12:00" && h.reminderTime < "18:00"], ["Večer", (h) => h.reminderTime && h.reminderTime >= "18:00"], ["Kedykoľvek", (h) => !h.reminderTime]]
      .map(([label, fn]) => [label, hs.filter(fn)])
      .filter(([, items]) => items.length);

    app.innerHTML = `
      <header class="page-head">
        <div class="head-row">
          <div>
            <p class="eyebrow">${isToday ? greeting() + name : "Spätný pohľad"}</p>
            <h1 class="title">${isToday ? "Čo dnes dodržíš?" : fmtLong(date)}</h1>
            <div class="date-nav">
              <button class="nav-btn" data-action="day" data-d="-1" aria-label="Predchádzajúci deň"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
              <strong>${relDay(date)}</strong>${isToday ? ` <span class="muted">· ${fmtShort(date)}</span>` : ""}
              <button class="nav-btn" data-action="day" data-d="1" aria-label="Ďalší deň"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
              ${!isToday ? `<button class="pill" data-action="goto-today">Dnes</button>` : ""}
            </div>
          </div>
          <button class="icon-btn" data-action="share-day" aria-label="Zdieľať deň" title="Zdieľať deň">⤴</button>
        </div>
      </header>

      <section class="card hero">
        <div class="ring" style="--p:${s.pct ?? 0}"><div><b>${s.pct ?? 0}%</b><small>splnené</small></div></div>
        <div>
          <p class="big">${s.total === 0 ? "Nič naplánované" : s.done === s.total ? "Všetko splnené! 🎉" : `${s.done} z ${s.total} splnených`}</p>
          <p>${s.total === 0 ? "Pridaj si predsavzatie a začni." : s.done === s.total ? "Buď na seba hrdý. Takto sa buduje disciplína." : s.pct >= 50 ? "Si za polovicou. Drž to." : "Jedno po druhom. Zvládneš to."}</p>
          ${isToday ? `<p class="quote">„${esc(quoteOfDay())}“</p>` : ""}
        </div>
      </section>

      <section class="card oneoff-card mt"><div class="card-title"><span>Jednorazové úlohy</span><button class="btn sm outline" data-action="add-oneoff">+ Pridať</button></div>
        ${state.oneOffs.filter((x) => x.date === date).length ? `<ul class="oneoff-list mt">${state.oneOffs.filter((x) => x.date === date).map((x) => `<li class="oneoff-item ${x.done ? "done" : ""}"><button class="check" data-action="toggle-oneoff" data-id="${esc(x.id)}" ${future ? "disabled" : ""} aria-label="Označiť úlohu">${x.done ? "✓" : ""}</button><span class="oneoff-emoji">${esc(x.emoji || "🌿")}</span><span class="oneoff-name">${esc(x.title)}</span>${x.time ? `<small>${esc(x.time)}</small>` : ""}<button class="more" data-action="delete-oneoff" data-id="${esc(x.id)}" aria-label="Odstrániť">×</button></li>`).join("")}</ul>` : `<p class="small muted mt">Úlohy, ktoré platia iba pre tento deň.</p>`}
      </section>
      ${state.habits.length === 0
        ? `<div class="empty mt"><div class="ico">🌱</div><strong>Zatiaľ žiadne predsavzatia</strong><p>Začni s jedným, ktoré zvládneš aj v najhorší deň.</p><a class="btn mt" href="#/add">+ Pridať prvé predsavzatie</a></div>`
        : hs.length === 0
          ? `<div class="empty mt"><div class="ico">🛋️</div><strong>Deň voľna</strong><p>Na tento deň nemáš naplánované žiadne predsavzatie.</p></div>`
          : groups.map(([label, items]) => `
              <p class="group-label">${label}</p>
              <ul class="habit-list">${items.map((h) => habitItem(h, date, future)).join("")}</ul>`).join("")}

      ${state.habits.length > 0 && isToday ? `<p class="small muted center mt">Klepni na krúžok pre splnenie · podrž alebo klepni na ⋯ pre úpravu</p>` : ""}
    `;
    app.onclick = (e) => {
      const el = e.target.closest("[data-action]");
      if (!el) return;
      const a = el.dataset.action;
      if (a === "day") go(`#/home/${addDays(date, Number(el.dataset.d))}`);
      if (a === "goto-today") go("#/home");
      if (a === "toggle") {
        if (future) return toast({ title: "Budúci deň", body: "Označiť môžeš len dnešok alebo minulosť." });
        const h = state.habits.find((x) => x.id === el.dataset.id);
        const next = !isDone(h, date);
        setDone(h, date, next);
        if (navigator.vibrate) navigator.vibrate(10);
        renderHome(app, date);
        if (next) {
          const st = dayStats(date);
          if (st.done === st.total) toast({ kind: "success", title: "Všetko splnené! 🎉", body: isToday ? "Zdieľaj svoj deň s kamarátom." : undefined });
        }
      }
      if (a === "menu") habitMenu(state.habits.find((x) => x.id === el.dataset.id), date, () => renderHome(app, date));
      if (a === "share-day") shareDay(date);
      if (a === "add-oneoff") addOneOff(date, () => renderHome(app, date));
      if (a === "toggle-oneoff") { const task = state.oneOffs.find((x) => x.id === el.dataset.id); if (task && !future) { task.done = !task.done; save(); renderHome(app, date); } }
      if (a === "delete-oneoff") { state.oneOffs = state.oneOffs.filter((x) => x.id !== el.dataset.id); save(); renderHome(app, date); }
    };
  }

  function addOneOff(date, after) {
    sheet(`<h3>Jednorazová úloha</h3><p class="sub">Platí iba pre vybraný deň – nebude sa opakovať.</p>
      <label class="field"><span>Čo chceš urobiť?</span><input class="input" id="oneoff-title" maxlength="100" placeholder="napr. Zavolať lekárovi" required /></label>
      <div class="row"><label class="field"><span>Dátum</span><input class="input" id="oneoff-date" type="date" value="${esc(date)}" required /></label><label class="field"><span>Čas (voliteľný)</span><input class="input" id="oneoff-time" type="time" /></label></div>
      <div class="btn-row"><button class="btn secondary" data-cancel>Zrušiť</button><button class="btn" data-save>Pridať úlohu</button></div>`, (el) => {
      $("[data-cancel]", el).onclick = closeSheet;
      $("[data-save]", el).onclick = () => {
        const title = $("#oneoff-title", el).value.trim(), taskDate = $("#oneoff-date", el).value;
        if (!title || !taskDate) return toast({ kind: "error", title: "Doplň názov a dátum úlohy" });
        state.oneOffs.push({ id: uid(), title, date: taskDate, time: $("#oneoff-time", el).value, emoji: "🌿", done: false, createdAt: new Date().toISOString() });
        save(); closeSheet(); toast({ kind: "success", title: "Úloha pridaná" }); after();
      };
    });
  }

  function habitItem(h, date, future) {
    const done = isDone(h, date);
    const st = streak(h, date);
    const c = COLORS[h.color] || COLORS.teal;
    return `<li class="habit ${done ? "done" : ""}" style="--c-soft:${soft(c)}">
      <button class="check" data-action="toggle" data-id="${h.id}" aria-label="${done ? "Zrušiť splnenie" : "Označiť ako splnené"}" ${future ? "disabled" : ""}><svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg></button>
      <div class="emoji">${esc(h.emoji)}</div>
      <div class="body" data-action="menu" data-id="${h.id}">
        <div class="name">${esc(h.name)}</div>
        <div class="meta">${h.reminderTime ? `<span>⏰ ${h.reminderTime}</span>` : ""}${st > 0 ? `<span class="streak">🔥 ${st} ${st === 1 ? "deň" : st < 5 ? "dni" : "dní"}</span>` : ""}${h.description ? `<span class="desc">${esc(h.description)}</span>` : ""}</div>
      </div>
      <button class="more" data-action="menu" data-id="${h.id}" aria-label="Možnosti">⋯</button>
    </li>`;
  }

  function habitMenu(h, date, after) {
    if (!h) return;
    const c = COLORS[h.color] || COLORS.teal;
    sheet(`
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:12px">
        <div class="emoji" style="width:48px;height:48px;border-radius:16px;display:grid;place-items:center;font-size:24px;background:${soft(c)}">${esc(h.emoji)}</div>
        <div><h3 style="margin:0">${esc(h.name)}</h3><p class="sub" style="margin:0">${esc(h.description || "Bez opisu")}</p></div>
      </div>
      <div class="grid-2">
        <div class="stat"><div class="label">Aktuálna séria</div><div class="value">🔥 ${streak(h)}</div></div>
        <div class="stat"><div class="label">Najlepšia séria</div><div class="value">${bestStreak(h)}</div></div>
        <div class="stat"><div class="label">Úspešnosť 30 dní</div><div class="value">${rate(h) ?? "–"}${rate(h) !== null ? "%" : ""}</div></div>
        <div class="stat"><div class="label">Od</div><div class="value" style="font-size:16px">${fmtShort(h.startDate)}</div><div class="hint">${h.days.length === 7 ? "každý deň" : h.days.map((d) => DAYS_SHORT[d]).join(", ")}${h.reminderTime ? " · " + h.reminderTime : ""}</div></div>
      </div>
      <div class="list mt">
        <button class="list-row" data-m="edit"><span class="ico">✏️</span><span class="txt"><b>Upraviť</b><span>Názov, čas, dni, farba</span></span><span class="chev">›</span></button>
        <button class="list-row" data-m="share"><span class="ico">⤴</span><span class="txt"><b>Poslať kamarátovi</b><span>Výzva – rovnaké predsavzatie pre neho</span></span><span class="chev">›</span></button>
        <button class="list-row" data-m="archive"><span class="ico">${h.archived ? "♻️" : "📦"}</span><span class="txt"><b>${h.archived ? "Obnoviť" : "Pozastaviť"}</b><span>${h.archived ? "Znova sa zobrazí v dňoch" : "Skryje sa, história ostane"}</span></span><span class="chev">›</span></button>
        <button class="list-row" data-m="delete"><span class="ico" style="background:var(--danger-soft)">🗑️</span><span class="txt"><b class="danger-text">Odstrániť</b><span>Natrvalo aj s históriou</span></span><span class="chev">›</span></button>
      </div>`, (el) => {
      el.querySelectorAll("[data-m]").forEach((b) => (b.onclick = async () => {
        const m = b.dataset.m;
        closeSheet();
        if (m === "edit") go(`#/edit/${h.id}`);
        if (m === "share") shareHabit(h);
        if (m === "archive") { h.archived = !h.archived; save(); toast({ title: h.archived ? "Predsavzatie pozastavené" : "Predsavzatie obnovené" }); after && after(); }
        if (m === "delete") {
          if (await confirmSheet({ title: `Odstrániť „${h.name}“?`, body: "Odstráni sa aj celá história splnení. Toto sa nedá vrátiť.", ok: "Odstrániť", danger: true })) {
            state.habits = state.habits.filter((x) => x.id !== h.id);
            for (const d of Object.keys(state.logs)) { delete state.logs[d][h.id]; if (!Object.keys(state.logs[d]).length) delete state.logs[d]; }
            save();
            toast({ title: "Predsavzatie odstránené" });
            after && after();
          }
        }
      }));
    });
  }

  /* ---------- Formulár (pridať / upraviť) ---------- */
  let pendingImport = null;
  function renderForm(app, habit) {
    const editing = !!habit;
    const f = Object.assign({ name: "", description: "", emoji: "✅", color: "teal", startDate: todayStr(), reminderTime: "", days: [0, 1, 2, 3, 4, 5, 6], repeat: "daily" }, habit || pendingImport || {});
    if (habit) f.repeat = habit.days.length === 7 ? "daily" : "custom";
    pendingImport = null;

    const draw = () => {
      app.innerHTML = `
        <header class="page-head">
          <p class="eyebrow">${editing ? "Úprava" : "Nové predsavzatie"}</p>
          <h1 class="title">${editing ? "Upraviť predsavzatie" : "Čo chceš dodržiavať?"}</h1>
          <p class="subtitle">Formuluj to konkrétne a dosiahnuteľne.</p>
        </header>
        <form id="hform" class="card" novalidate>
          <label class="field"><span>Názov</span><input class="input" name="name" value="${esc(f.name)}" placeholder="napr. Vypiť 2 litre vody" maxlength="80" required autocomplete="off" /></label>
          <label class="field"><span>Krátky opis <span class="muted" style="font-weight:400">(voliteľné)</span></span><textarea class="input" name="description" placeholder="Prečo to robím, ako to zvládnem…" maxlength="300">${esc(f.description)}</textarea></label>
          <div class="field"><span>Ikona</span><div class="chips" id="emojis">${EMOJIS.map((e) => `<button type="button" class="chip ${f.emoji === e ? "on" : ""}" data-e="${e}">${e}</button>`).join("")}</div></div>
          <div class="field"><span>Farba</span><div class="swatches" id="colors">${Object.entries(COLORS).map(([k, v]) => `<button type="button" class="swatch ${f.color === k ? "on" : ""}" data-c="${k}" style="background:${v}" aria-label="${k}"></button>`).join("")}</div></div>
          <div class="row">
            <label class="field"><span>Začať od</span><input class="input" type="date" name="startDate" value="${f.startDate}" required /></label>
            <label class="field"><span>Čas pripomienky</span><input class="input" type="time" name="reminderTime" value="${f.reminderTime || ""}" /></label>
          </div>
          <div class="field"><span>Opakovanie</span>
            <div class="segment" id="repeat"><button type="button" data-r="daily" class="${f.repeat === "daily" ? "on" : ""}">Každý deň</button><button type="button" data-r="custom" class="${f.repeat === "custom" ? "on" : ""}">Vybrané dni</button></div>
            <div class="daypick mt" id="days" ${f.repeat === "daily" ? "hidden" : ""}>${[1, 2, 3, 4, 5, 6, 0].map((d) => `<button type="button" data-d="${d}" class="${f.days.includes(d) ? "on" : ""}">${DAYS_SHORT[d]}</button>`).join("")}</div>
          </div>
          <p class="small muted" id="err" hidden></p>
          <div class="btn-row">
            <a class="btn secondary" href="${editing ? "#/home" : "#/home"}">Zrušiť</a>
            <button class="btn" type="submit">${editing ? "Uložiť zmeny" : "Vytvoriť"}</button>
          </div>
        </form>`;

      $("#emojis").onclick = (e) => { const b = e.target.closest("[data-e]"); if (!b) return; f.emoji = b.dataset.e; $("#emojis").querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c.dataset.e === f.emoji)); };
      $("#colors").onclick = (e) => { const b = e.target.closest("[data-c]"); if (!b) return; f.color = b.dataset.c; $("#colors").querySelectorAll(".swatch").forEach((c) => c.classList.toggle("on", c.dataset.c === f.color)); };
      $("#repeat").onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; f.repeat = b.dataset.r; $("#repeat").querySelectorAll("button").forEach((c) => c.classList.toggle("on", c.dataset.r === f.repeat)); $("#days").hidden = f.repeat === "daily"; if (f.repeat === "daily") { f.days = [0, 1, 2, 3, 4, 5, 6]; $("#days").querySelectorAll("button").forEach((c) => c.classList.add("on")); } };
      $("#days").onclick = (e) => { const b = e.target.closest("[data-d]"); if (!b) return; const d = Number(b.dataset.d); f.days = f.days.includes(d) ? f.days.filter((x) => x !== d) : [...f.days, d].sort(); b.classList.toggle("on"); };

      $("#hform").onsubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = String(fd.get("name") || "").trim();
        const err = $("#err");
        if (!name) { err.textContent = "Zadaj názov predsavzatia."; err.hidden = false; err.classList.add("danger-text"); return; }
        if (!f.days.length) { err.textContent = "Vyber aspoň jeden deň."; err.hidden = false; err.classList.add("danger-text"); return; }
        const data = { name, description: String(fd.get("description") || "").trim(), emoji: f.emoji, color: f.color, startDate: String(fd.get("startDate")) || todayStr(), reminderTime: String(fd.get("reminderTime") || "") || null, days: f.days };
        if (editing) {
          Object.assign(habit, data);
          save();
          toast({ kind: "success", title: "Zmeny uložené" });
        } else {
          state.habits.push(Object.assign({ id: uid(), archived: false, createdAt: new Date().toISOString() }, data));
          save();
          toast({ kind: "success", title: "Predsavzatie vytvorené", body: `${data.emoji} ${data.name}` });
          if (data.reminderTime && state.settings.notifications && "Notification" in window && Notification.permission === "default") askNotificationPermission();
        }
        go(data.startDate > todayStr() ? `#/home/${data.startDate}` : "#/home");
      };
    };
    draw();
  }

  /* ---------- Kalendár ---------- */
  function renderCalendar(app, arg) {
    const t = todayStr();
    let [y, m] = /^\d{4}-\d{2}$/.test(arg) ? arg.split("-").map(Number) : [fromStr(t).getFullYear(), fromStr(t).getMonth() + 1];
    let selected = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : t.startsWith(`${y}-${pad(m)}`) ? t : `${y}-${pad(m)}-01`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) { [y, m] = [fromStr(arg).getFullYear(), fromStr(arg).getMonth() + 1]; }

    const draw = () => {
      const first = new Date(y, m - 1, 1);
      const daysInMonth = new Date(y, m, 0).getDate();
      const lead = (first.getDay() + 6) % 7; // pondelok prvý
      let monthSched = 0, monthDone = 0;
      const cells = [];
      for (let i = 0; i < lead; i++) cells.push(`<div class="cal-day other"></div>`);
      for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${y}-${pad(m)}-${pad(d)}`;
        const s = dayStats(ds);
        if (ds <= t) { monthSched += s.total; monthDone += s.done; }
        const cls = ["cal-day", s.total ? "has" : "", s.pct === 100 ? "full" : "", ds === t ? "today" : "", ds === selected ? "sel" : "", ds > t ? "future" : ""].join(" ");
        cells.push(`<button class="${cls}" style="--p:${s.pct ?? 0}" data-day="${ds}">${d}${s.total ? `<small>${s.done}/${s.total}</small>` : ""}</button>`);
      }
      const sel = dayStats(selected);
      const hs = habitsFor(selected);
      const oneOffs = state.oneOffs.filter((x) => x.date === selected);
      app.innerHTML = `
        <header class="page-head">
          <p class="eyebrow">História</p>
          <h1 class="title">Kalendár</h1>
          <p class="subtitle">Tento mesiac: ${monthSched ? Math.round((monthDone / monthSched) * 100) + " % splnených" : "zatiaľ žiadne dáta"} · ${monthDone} splnení</p>
        </header>
        <section class="card">
          <div class="cal-head">
            <button class="icon-btn" data-nav="-1" aria-label="Predchádzajúci mesiac">‹</button>
            <h2>${MONTHS_NOM[m - 1]} ${y}</h2>
            <button class="icon-btn" data-nav="1" aria-label="Ďalší mesiac">›</button>
          </div>
          <div class="cal-grid">${["Po", "Ut", "St", "Št", "Pi", "So", "Ne"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}${cells.join("")}</div>
          <div class="legend">Menej <i style="background:color-mix(in srgb,var(--brand) 15%,var(--card-2))"></i><i style="background:color-mix(in srgb,var(--brand) 45%,var(--card-2))"></i><i style="background:color-mix(in srgb,var(--brand) 75%,var(--card-2))"></i><i style="background:var(--brand)"></i> Viac</div>
        </section>
        <section class="card">
          <div class="card-title"><span>${relDay(selected)}</span>${sel.total ? `<span class="pill ${sel.pct === 100 ? "" : "muted"}">${sel.done}/${sel.total} · ${sel.pct}%</span>` : ""}</div>
          ${hs.length === 0 ? `<p class="muted small mt">Na tento deň nebolo nič naplánované.</p>` : `<ul class="habit-list mt">${hs.map((h) => habitItem(h, selected, selected > t)).join("")}</ul>`}
          ${selected > t ? `<p class="small muted mt">Budúci deň – označiť budeš môcť, keď príde.</p>` : ""}
        </section>
        <section class="card mt oneoff-card">
          <div class="card-title"><span>Jednorazové úlohy</span><button class="btn sm outline" data-action="add-oneoff">+ Pridať</button></div>
          ${oneOffs.length ? `<ul class="oneoff-list mt">${oneOffs.map((x) => `<li class="oneoff-item ${x.done ? "done" : ""}"><button class="check" data-action="toggle-oneoff" data-id="${esc(x.id)}" ${selected > t ? "disabled" : ""} aria-label="Označiť úlohu">${x.done ? "✓" : ""}</button><span class="oneoff-emoji">${esc(x.emoji || "🌿")}</span><span class="oneoff-name">${esc(x.title)}</span>${x.time ? `<small>${esc(x.time)}</small>` : ""}<button class="more" data-action="delete-oneoff" data-id="${esc(x.id)}" aria-label="Odstrániť">×</button></li>`).join("")}</ul>` : `<p class="small muted mt">Na tento deň nemáš jednorazovú úlohu.</p>`}
        </section>`;
      app.querySelectorAll("[data-nav]").forEach((b) => (b.onclick = () => { m += Number(b.dataset.nav); if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } selected = `${y}-${pad(m)}-01`; if (t.startsWith(`${y}-${pad(m)}`)) selected = t; draw(); }));
      app.querySelectorAll("[data-day]").forEach((b) => (b.onclick = () => { selected = b.dataset.day; draw(); }));
      app.onclick = (e) => {
        const el = e.target.closest("[data-action]");
        if (!el) return;
        if (el.dataset.action === "toggle") {
          if (selected > t) return;
          const h = state.habits.find((x) => x.id === el.dataset.id);
          setDone(h, selected, !isDone(h, selected));
          draw();
        }
        if (el.dataset.action === "menu") habitMenu(state.habits.find((x) => x.id === el.dataset.id), selected, draw);
        if (el.dataset.action === "add-oneoff") addOneOff(selected, draw);
        if (el.dataset.action === "toggle-oneoff") {
          const task = state.oneOffs.find((x) => x.id === el.dataset.id);
          if (task && selected <= t) { task.done = !task.done; save(); draw(); }
        }
        if (el.dataset.action === "delete-oneoff") {
          state.oneOffs = state.oneOffs.filter((x) => x.id !== el.dataset.id);
          save(); draw();
        }
      };
    };
    draw();
  }

  /* ---------- Štatistiky ---------- */
  function renderStats(app) {
    const t = todayStr();
    const active = state.habits.filter((h) => !h.archived);
    const today = dayStats(t);
    const week = [];
    for (let i = 6; i >= 0; i--) { const d = addDays(t, -i); week.push({ d, ...dayStats(d) }); }
    const weekSched = week.reduce((s, x) => s + x.total, 0), weekDone = week.reduce((s, x) => s + x.done, 0);
    const [y, mo] = [fromStr(t).getFullYear(), fromStr(t).getMonth()];
    let mSched = 0, mDone = 0;
    for (let d = `${y}-${pad(mo + 1)}-01`; d <= t; d = addDays(d, 1)) { const s = dayStats(d); mSched += s.total; mDone += s.done; }
    const best = active.reduce((b, h) => { const bs = bestStreak(h); return bs > b.n ? { n: bs, h } : b; }, { n: 0, h: null });
    const perfect = perfectStreak();

    app.innerHTML = `
      <header class="page-head"><p class="eyebrow">Progres</p><h1 class="title">Štatistiky</h1><p class="subtitle">Nie je to tabuľka výsledkov – je to zrkadlo. Hľadaj trend, nie dokonalosť.</p></header>
      ${active.length === 0 ? `<div class="empty"><div class="ico">📊</div><strong>Zatiaľ nie je čo merať</strong><p>Pridaj si predsavzatie a po pár dňoch sa tu objaví tvoj pokrok.</p><a class="btn mt" href="#/add">+ Pridať predsavzatie</a></div>` : `
      <div class="grid-2">
        <div class="stat"><div class="label">Celkový progres</div><div class="value">${totalCompletions()}</div><div class="hint">splnených predsavzatí celkovo</div></div>
        <div class="stat"><div class="label">Denná úspešnosť</div><div class="value">${today.pct ?? 0}%</div><div class="hint">${today.done}/${today.total} dnes</div></div>
        <div class="stat"><div class="label">Séria dní</div><div class="value">🔥 ${perfect}</div><div class="hint">dní po sebe so všetkým splneným</div></div>
        <div class="stat"><div class="label">Najlepší výsledok</div><div class="value">${best.n}</div><div class="hint">${best.h ? `${best.h.emoji} ${esc(best.h.name)}` : "najdlhšia séria"}</div></div>
      </div>
      <section class="card mt">
        <div class="card-title"><span>Posledných 7 dní</span><span class="pill">${weekSched ? Math.round((weekDone / weekSched) * 100) : 0}%</span></div>
        <div class="bars">${week.map((w) => `<div class="bar ${w.d === t ? "today" : ""}"><b>${w.pct ?? "–"}${w.pct !== null ? "%" : ""}</b><div class="track"><div class="fill" style="height:${w.pct ?? 0}%"></div></div><span>${DAYS_SHORT[dow(w.d)]}</span></div>`).join("")}</div>
      </section>
      <section class="card">
        <div class="card-title"><span>${MONTHS_NOM[mo]} ${y}</span><span class="pill ${mSched ? "" : "muted"}">${mSched ? Math.round((mDone / mSched) * 100) : 0}%</span></div>
        <div class="hbar"><i style="width:${mSched ? Math.round((mDone / mSched) * 100) : 0}%"></i></div>
        <p class="small muted mt">${mDone} splnených z ${mSched} naplánovaných od začiatku mesiaca.</p>
        <a class="link small" href="#/calendar" style="display:inline-block;margin-top:8px;color:var(--brand);font-weight:600">Otvoriť kalendár ›</a>
      </section>
      <section class="card">
        <div class="card-title"><span>Podľa predsavzatia</span><span class="small muted">30 dní</span></div>
        <div class="list mt">${active.map((h) => { const r = rate(h); const c = COLORS[h.color] || COLORS.teal; return `<div class="list-row" style="display:block;padding:12px 0">
          <div style="display:flex;align-items:center;gap:10px"><span class="ico" style="background:${soft(c)}">${esc(h.emoji)}</span><span class="txt"><b>${esc(h.name)}</b><span>séria ${streak(h)} · najlepšia ${bestStreak(h)}</span></span><b>${r ?? "–"}${r !== null ? "%" : ""}</b></div>
          <div class="hbar"><i style="width:${r ?? 0}%;--c:${c}"></i></div></div>`; }).join("")}</div>
      </section>`}
    `;
  }

  /* ---------- Nastavenia ---------- */
  function renderSettings(app) {
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    app.innerHTML = `
      <header class="page-head"><p class="eyebrow">Ty</p><h1 class="title">Nastavenia</h1></header>
      <section class="card">
        <label class="field"><span>Osobný profil</span><div class="profile-edit"><span class="profile-avatar">${esc(state.profile.avatar || "🌱")}</span><input class="input" id="name" value="${esc(state.profile.name)}" placeholder="Ako ťa máme oslovovať?" maxlength="40" /></div></label>
        <div class="field"><span>Tvoja ikona</span><div class="chips" id="profile-avatars">${["🌱","🌿","🍃","🌳","🌻","🌸","🪴","✨","🦋","☀️"].map((v) => `<button type="button" class="chip ${state.profile.avatar === v ? "on" : ""}" data-avatar="${v}">${v}</button>`).join("")}</div></div>
        <div class="field"><span>Vzhľad</span><div class="segment" id="theme">${[["auto", "Automaticky"], ["light", "Svetlý"], ["dark", "Tmavý"]].map(([k, l]) => `<button type="button" data-t="${k}" class="${state.settings.theme === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
        <div class="field mt" style="margin-bottom:0"><span>Sezónny motív</span><div class="segment" id="season">${[["auto","Automaticky"],["spring","Jar"],["summer","Leto"],["autumn","Jeseň"],["winter","Zima"]].map(([k,l]) => `<button type="button" data-season="${k}" class="${(state.settings.season || "auto") === k ? "on" : ""}">${l}</button>`).join("")}</div><p class="small muted mt">Automatický motív sa mení podľa ročného obdobia.</p></div>
      </section>
      <section class="card">
        <div class="card-title">Pripomienky</div>
        <div class="list mt">
          <div class="list-row"><span class="ico">🔔</span><span class="txt"><b>Upozornenia na predsavzatia a úlohy</b><span>V čase pripomienky, keď je aplikácia otvorená</span></span><button class="switch ${state.settings.notifications ? "on" : ""}" id="notif" aria-label="Upozornenia"></button></div>
          <div class="list-row"><span class="ico">📲</span><span class="txt"><b>Systémové notifikácie</b><span>${perm === "granted" ? "Povolené ✓" : perm === "denied" ? "Zablokované – povoľ v nastaveniach prehliadača" : perm === "unsupported" ? (standalone ? "Nepodporované" : "Na iPhone: najprv pridaj na plochu, potom povoľ") : "Zatiaľ nepovolené"}</span></span>${perm === "default" ? `<button class="btn sm" id="perm">Povoliť</button>` : ""}</div>
          <div class="list-row"><span class="ico">🚧</span><span class="txt"><b>Upozornenia na pozadí (Web Push)</b><span>Vyžaduje serverovú časť – pripravené v service workeri, zatiaľ neaktívne</span></span></div>
        </div>
      </section>
      <section class="card">
        <div class="card-title">Dáta</div>
        <div class="list mt">
          <a class="list-row" href="#/backup"><span class="ico">💾</span><span class="txt"><b>Záloha a obnovenie</b><span>Export / import JSON súboru</span></span><span class="chev">›</span></a>
          <button class="list-row" id="archived"><span class="ico">📦</span><span class="txt"><b>Pozastavené predsavzatia</b><span>${state.habits.filter((h) => h.archived).length} pozastavených</span></span><span class="chev">›</span></button>
          <button class="list-row" id="reset"><span class="ico" style="background:var(--danger-soft)">🧨</span><span class="txt"><b class="danger-text">Vymazať všetky dáta</b><span>Začať úplne odznova</span></span><span class="chev">›</span></button>
        </div>
      </section>
      <section class="card">
        <div class="card-title">O aplikácii</div>
        <p class="small muted mt">Recovery Habit · verzia 1.0 · ${standalone ? "nainštalovaná na ploche" : "beží v prehliadači"}.<br/>Dáta sa ukladajú iba v tomto zariadení. Zdieľaním odkazu na aplikáciu nikomu neposkytneš prístup k svojim dátam.</p>
        ${!standalone ? `<button class="btn outline block mt" id="how-install">Ako pridať na plochu iPhonu</button>` : ""}
      </section>`;

    $("#name").onchange = (e) => { state.profile.name = e.target.value.trim(); save(); toast({ kind: "success", title: "Meno uložené" }); };
    $("#profile-avatars").onclick = (e) => { const b = e.target.closest("[data-avatar]"); if (!b) return; state.profile.avatar = b.dataset.avatar; save(); renderSettings(app); };
    $("#season").onclick = (e) => { const b = e.target.closest("[data-season]"); if (!b) return; state.settings.season = b.dataset.season; save(); applyTheme(); renderSettings(app); };
    $("#theme").onclick = (e) => { const b = e.target.closest("[data-t]"); if (!b) return; state.settings.theme = b.dataset.t; save(); applyTheme(); renderSettings(app); };
    $("#notif").onclick = () => { state.settings.notifications = !state.settings.notifications; save(); renderSettings(app); toast({ title: state.settings.notifications ? "Pripomienky zapnuté" : "Pripomienky pozastavené" }); };
    const permBtn = $("#perm"); if (permBtn) permBtn.onclick = () => askNotificationPermission().then(() => renderSettings(app));
    $("#reset").onclick = async () => {
      if (await confirmSheet({ title: "Vymazať všetky dáta?", body: "Odstránia sa všetky predsavzatia aj história. Najprv si urob zálohu.", ok: "Vymazať všetko", danger: true })) {
        state = defaultState(); save(); toast({ title: "Dáta vymazané" }); go("#/home");
      }
    };
    $("#archived").onclick = () => {
      const list = state.habits.filter((h) => h.archived);
      sheet(`<h3>Pozastavené</h3><p class="sub">Nezobrazujú sa v dňoch, história ostáva.</p>${list.length ? `<ul class="habit-list">${list.map((h) => `<li class="habit"><div class="emoji">${esc(h.emoji)}</div><div class="body"><div class="name">${esc(h.name)}</div></div><button class="btn sm secondary" data-restore="${h.id}">Obnoviť</button></li>`).join("")}</ul>` : `<p class="muted small">Nič pozastavené.</p>`}`, (el) => {
        el.querySelectorAll("[data-restore]").forEach((b) => (b.onclick = () => { const h = state.habits.find((x) => x.id === b.dataset.restore); h.archived = false; save(); closeSheet(); renderSettings(app); toast({ kind: "success", title: "Obnovené" }); }));
      });
    };
    const how = $("#how-install"); if (how) how.onclick = showInstallHelp;
  }

  function showInstallHelp() {
    sheet(`<h3>Pridať na plochu</h3><p class="sub">Potom sa Recovery Habit otvára ako bežná aplikácia – na celú obrazovku, s ikonou a bez panela prehliadača.</p>
      <div class="list">
        <div class="list-row"><span class="ico">1</span><span class="txt"><b>iPhone / iPad (Safari)</b><span>Klepni na <b>Zdieľať</b> (štvorec so šípkou) → <b>Pridať na plochu</b> → <b>Pridať</b>.</span></span></div>
        <div class="list-row"><span class="ico">2</span><span class="txt"><b>Android (Chrome)</b><span>Menu ⋮ → <b>Pridať na plochu</b> / <b>Inštalovať aplikáciu</b>.</span></span></div>
        <div class="list-row"><span class="ico">3</span><span class="txt"><b>Počítač (Chrome / Edge)</b><span>Ikona inštalácie v adresnom riadku → <b>Inštalovať</b>.</span></span></div>
      </div>
      <p class="small muted mt">Tip: na iPhone sa systémové notifikácie dajú povoliť až po pridaní na plochu (iOS 16.4+).</p>
      <button class="btn block mt" data-ok>Rozumiem</button>`, (el) => { $("[data-ok]", el).onclick = closeSheet; });
  }

  /* ---------- Záloha ---------- */
  function renderBackup(app) {
    const count = state.habits.length, logs = totalCompletions();
    app.innerHTML = `
      <header class="page-head"><p class="eyebrow">Dáta</p><h1 class="title">Záloha a obnovenie</h1><p class="subtitle">Dáta sú iba v tomto zariadení. Zálohou ich prenesieš inam alebo ochrániš pred stratou.</p></header>
      <section class="card">
        <div class="card-title">Export</div>
        <p class="small muted mt">Vytvorí súbor JSON s ${count} predsavzatiami a ${logs} splneniami. Na iPhone ho ulož do <b>Súbory</b> / iCloud Drive.</p>
        <div class="btn-row"><button class="btn" id="export">⬇ Stiahnuť zálohu</button>${navigator.share ? `<button class="btn secondary" id="share-backup">⤴ Zdieľať</button>` : ""}</div>
      </section>
      <section class="card">
        <div class="card-title">Import</div>
        <p class="small muted mt">Nahraj skôr vytvorenú zálohu. Môžeš nahradiť všetko, alebo zlúčiť s aktuálnymi dátami.</p>
        <input type="file" id="file" accept="application/json,.json" hidden />
        <div class="btn-row"><button class="btn outline" id="import-replace">Nahradiť všetko</button><button class="btn outline" id="import-merge">Zlúčiť</button></div>
      </section>
      <section class="card">
        <div class="card-title">Prenos do iného zariadenia</div>
        <ol class="small muted mt" style="padding-left:18px;line-height:1.7"><li>Tu: <b>Stiahnuť zálohu</b> → ulož do iCloud / Google Drive.</li><li>V novom zariadení otvor Recovery Habit a pridaj na plochu.</li><li>Nastavenia → Záloha → <b>Nahradiť všetko</b> → vyber súbor.</li></ol>
      </section>`;

    $("#export").onclick = exportBackup;
    const sb = $("#share-backup"); if (sb) sb.onclick = shareBackup;
    let mode = "replace";
    $("#import-replace").onclick = () => { mode = "replace"; $("#file").click(); };
    $("#import-merge").onclick = () => { mode = "merge"; $("#file").click(); };
    $("#file").onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!data || !Array.isArray(data.habits) || typeof data.logs !== "object") throw new Error("Neplatný formát súboru.");
        const ok = await confirmSheet({ title: mode === "replace" ? "Nahradiť všetky dáta?" : "Zlúčiť so zálohou?", body: `Záloha obsahuje ${data.habits.length} predsavzatí a ${Object.values(data.logs).reduce((s, d) => s + Object.keys(d).length, 0)} splnení${data.exportedAt ? ` (z ${new Date(data.exportedAt).toLocaleDateString("sk")})` : ""}.`, ok: mode === "replace" ? "Nahradiť" : "Zlúčiť", danger: mode === "replace" });
        if (!ok) return;
        if (mode === "replace") {
          state = Object.assign(defaultState(), data, { settings: Object.assign(defaultState().settings, data.settings || {}) });
        } else {
          const ids = new Set(state.habits.map((h) => h.id));
          for (const h of data.habits) if (!ids.has(h.id)) state.habits.push(h);
          for (const [d, entry] of Object.entries(data.logs)) state.logs[d] = Object.assign(state.logs[d] || {}, entry);
          if (!state.profile.name && data.profile?.name) state.profile.name = data.profile.name;
        }
        save();
        toast({ kind: "success", title: "Dáta obnovené", body: `${state.habits.length} predsavzatí` });
        go("#/home");
      } catch (err) {
        toast({ kind: "error", title: "Import zlyhal", body: err.message || "Skontroluj, či ide o zálohu z Recovery Habit." });
      } finally { e.target.value = ""; }
    };
  }

  function backupBlob() {
    const payload = Object.assign({}, state, { exportedAt: new Date().toISOString(), app: "Recovery Habit" });
    return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  }
  const backupName = () => `recovery-habit-zaloha-${todayStr()}.json`;
  function exportBackup() {
    const url = URL.createObjectURL(backupBlob());
    const a = document.createElement("a"); a.href = url; a.download = backupName(); document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast({ kind: "success", title: "Záloha vytvorená", body: backupName() });
  }
  async function shareBackup() {
    try {
      const file = new File([backupBlob()], backupName(), { type: "application/json" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: "Recovery Habit – záloha" });
      else exportBackup();
    } catch (e) { if (e.name !== "AbortError") exportBackup(); }
  }

  /* ---------- Zdieľanie ---------- */
  async function shareText(title, text, url) {
    try {
      if (navigator.share) { await navigator.share(Object.assign({ title, text }, url ? { url } : {})); return; }
      await navigator.clipboard.writeText(url ? `${text}\n${url}` : text);
      toast({ kind: "success", title: "Skopírované do schránky" });
    } catch (e) {
      if (e.name === "AbortError") return;
      try { await navigator.clipboard.writeText(text); toast({ kind: "success", title: "Skopírované do schránky" }); } catch { toast({ kind: "error", title: "Zdieľanie nie je dostupné" }); }
    }
  }
  function shareDay(date) {
    const hs = habitsFor(date), s = dayStats(date);
    const lines = hs.map((h) => `${isDone(h, date) ? "✅" : "⬜️"} ${h.emoji} ${h.name}`);
    const text = `${relDay(date)} – Recovery Habit\n${s.done}/${s.total} splnených (${s.pct ?? 0} %)\n\n${lines.join("\n") || "Nič naplánované."}\n\n„${quoteOfDay()}“`;
    shareText("Môj deň", text);
  }
  function shareHabit(h) {
    const data = btoa(unescape(encodeURIComponent(JSON.stringify({ name: h.name, description: h.description, emoji: h.emoji, color: h.color, reminderTime: h.reminderTime, days: h.days })))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const url = `${location.origin}${location.pathname}#/share/${data}`;
    shareText("Výzva", `Pridáš sa ku mne? ${h.emoji} ${h.name}${h.description ? " – " + h.description : ""}\nOtvor odkaz a pridaj si to do Recovery Habit:`, url);
  }
  function renderShareImport(app, data) {
    let h = null;
    try { h = JSON.parse(decodeURIComponent(escape(atob(data.replace(/-/g, "+").replace(/_/g, "/"))))); } catch { /* neplatné */ }
    if (!h || !h.name) { toast({ kind: "error", title: "Neplatný odkaz" }); return go("#/home"); }
    const c = COLORS[h.color] || COLORS.teal;
    app.innerHTML = `
      <header class="page-head"><p class="eyebrow">Výzva od kamaráta</p><h1 class="title">Pridáš sa?</h1><p class="subtitle">Niekto ti poslal predsavzatie. Môžeš si ho upraviť a pridať medzi svoje.</p></header>
      <section class="card" style="display:flex;gap:14px;align-items:center">
        <div style="width:56px;height:56px;border-radius:18px;display:grid;place-items:center;font-size:28px;background:${soft(c)}">${esc(h.emoji || "✅")}</div>
        <div><b style="font-size:17px">${esc(h.name)}</b><p class="small muted">${esc(h.description || "")}</p><p class="small muted">${Array.isArray(h.days) && h.days.length < 7 ? h.days.map((d) => DAYS_SHORT[d]).join(", ") : "každý deň"}${h.reminderTime ? " · " + esc(h.reminderTime) : ""}</p></div>
      </section>
      <div class="btn-row"><a class="btn secondary" href="#/home">Nie, ďakujem</a><button class="btn" id="accept">Pridať medzi moje</button></div>`;
    $("#accept").onclick = () => { pendingImport = { name: h.name, description: h.description || "", emoji: h.emoji || "✅", color: COLORS[h.color] ? h.color : "teal", reminderTime: h.reminderTime || "", days: Array.isArray(h.days) && h.days.length ? h.days : [0, 1, 2, 3, 4, 5, 6], repeat: Array.isArray(h.days) && h.days.length < 7 ? "custom" : "daily", startDate: todayStr() }; go("#/add"); };
  }

  /* ---------- Pripomienky ---------- */
  const fired = new Set();
  async function askNotificationPermission() {
    if (!("Notification" in window)) { toast({ title: "Notifikácie tu nie sú podporované", body: "Na iPhone najprv pridaj aplikáciu na plochu." }); return; }
    try {
      const res = await Notification.requestPermission();
      if (res === "granted") { toast({ kind: "success", title: "Notifikácie povolené" }); notify("Recovery Habit", "Pripomienky sú zapnuté. Držíme ti palce!", "welcome"); }
      else toast({ title: "Notifikácie nepovolené", body: "Pripomienky uvidíš aspoň v aplikácii." });
    } catch { /* ignore */ }
  }
  async function notify(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    try {
      const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
      if (reg && reg.showNotification) return reg.showNotification(title, { body, icon: "icon-192.png", badge: "icon-96.png", tag });
      new Notification(title, { body, icon: "icon-192.png", tag });
    } catch { /* ignore */ }
  }
  function tick() {
    if (!state.settings.notifications) return;
    const t = todayStr(), hm = nowHM();
    for (const h of habitsFor(t)) {
      if (!h.reminderTime || h.reminderTime !== hm || isDone(h, t)) continue;
      const key = `${h.id}:${t}:${hm}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const body = `Nezabudni: ${h.name}. ${QUOTES[Math.floor(Math.random() * QUOTES.length)]}`;
      toast({ kind: "reminder", title: `${h.emoji} ${h.name}`, body: "Čas na tvoje predsavzatie. " + QUOTES[Math.floor(Math.random() * QUOTES.length)] });
      notify(`${h.emoji} ${h.name}`, body, key);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }
    for (const task of state.oneOffs) {
      if (task.date !== t || !task.time || task.time !== hm || task.done) continue;
      const key = `oneoff:${task.id}:${t}:${hm}`;
      if (fired.has(key)) continue;
      fired.add(key);
      const body = `Nezabudni: ${task.title}. Čas na tvoj dnešný krok.`;
      toast({ kind: "reminder", title: `🌿 ${task.title}`, body });
      notify(`🌿 ${task.title}`, body, key);
      if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }
  }
  setInterval(tick, 20000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { tick(); render(); } });

  /* ---------- Téma ---------- */
  function applyTheme() {
    const pref = state.settings.theme;
    const dark = pref === "dark" || (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    const seasonPref = state.settings.season || "auto";
    const month = new Date().getMonth() + 1, day = new Date().getDate();
    const seasonal = month < 3 || (month === 3 && day < 20) || month === 12 && day >= 21 ? "winter"
      : month < 6 || (month === 6 && day < 21) ? "spring"
      : month < 9 || (month === 9 && day < 23) ? "summer" : "autumn";
    document.documentElement.dataset.season = seasonPref === "auto" ? seasonal : seasonPref;
  }
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  /* ---------- Inštalačný banner ---------- */
  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredPrompt = e; showInstallBanner(true); });
  function showInstallBanner(canPrompt) {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    if (standalone || state.settings.installDismissed) return;
    const banner = $("#install-banner");
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (!isIOS && !canPrompt) return;
    if (canPrompt) {
      $("#install-hint").innerHTML = `<button class="btn sm" id="install-now">Inštalovať</button>`;
      banner.hidden = false;
      $("#install-now").onclick = async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; banner.hidden = true; };
    } else {
      banner.hidden = false;
    }
    $("#install-close").onclick = () => { banner.hidden = true; state.settings.installDismissed = true; save(); };
  }

  /* ---------- Service worker ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  /* ---------- Štart ---------- */
  applyTheme();
  if (!state.settings.onboarded && state.habits.length === 0) {
    state.settings.onboarded = true;
    save();
    setTimeout(() => sheet(`<h3>Vitaj v Recovery Habit 🌱</h3><p class="sub">Osobný nástroj na budovanie disciplíny – jeden deň po druhom.</p>
      <div class="list">
        <div class="list-row"><span class="ico">✅</span><span class="txt"><b>Denné predsavzatia</b><span>Vytvor si návyky, označuj ich splnené, sleduj série.</span></span></div>
        <div class="list-row"><span class="ico">⏰</span><span class="txt"><b>Pripomienky</b><span>Nastav čas a aplikácia ťa upozorní.</span></span></div>
        <div class="list-row"><span class="ico">🔒</span><span class="txt"><b>Tvoje dáta, tvoje zariadenie</b><span>Nič sa neposiela na server. Zálohuj exportom.</span></span></div>
      </div>
      <div class="btn-row"><button class="btn secondary" data-demo>Ukážkové dáta</button><button class="btn" data-start>Začať</button></div>`, (el) => {
      $("[data-start]", el).onclick = () => { closeSheet(); go("#/add"); };
      $("[data-demo]", el).onclick = () => { seedDemo(); closeSheet(); render(); toast({ kind: "success", title: "Ukážkové dáta pridané", body: "Môžeš ich kedykoľvek vymazať v Nastaveniach." }); };
    }), 300);
  }
  render();
  setTimeout(() => showInstallBanner(false), 1500);

  function seedDemo() {
    const t = todayStr();
    const defs = [
      ["Vypiť 2 litre vody", "Fľaša stále na stole.", "💧", "blue", null, [0, 1, 2, 3, 4, 5, 6], 0.8],
      ["Zacvičiť si", "Aspoň 20 minút. Čokoľvek sa počíta.", "🏋️", "orange", "17:30", [1, 3, 5], 0.7],
      ["Prečítať 20 strán", "Namiesto telefónu pred spaním.", "📖", "violet", "21:00", [0, 1, 2, 3, 4, 5, 6], 0.65],
      ["Vstať o 7:00", "Budík na druhej strane izby.", "⏰", "amber", "07:00", [1, 2, 3, 4, 5], 0.75],
      ["Nejesť sladkosti", "Ovocie namiesto čokolády.", "🚫", "rose", null, [0, 1, 2, 3, 4, 5, 6], 0.6],
      ["Učiť sa angličtinu", "15 minút v aplikácii.", "🇬🇧", "teal", "19:00", [0, 1, 2, 3, 4, 5, 6], 0.7],
      ["Ísť spať pred 23:00", "Telefón do kuchyne o 22:30.", "🌙", "slate", "22:30", [0, 1, 2, 3, 4], 0.55],
    ];
    const start = addDays(t, -27);
    state.habits = defs.map(([name, description, emoji, color, reminderTime, days]) => ({ id: uid(), name, description, emoji, color, reminderTime, days, startDate: start, archived: false, createdAt: new Date().toISOString() }));
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 27; i >= 1; i--) {
      const d = addDays(t, -i);
      state.habits.forEach((h, idx) => { if (isScheduled(h, d) && rnd() < defs[idx][6] + (27 - i) * 0.006) setDone(h, d, true); });
    }
    state.habits.slice(0, 2).forEach((h) => isScheduled(h, t) && setDone(h, t, true));
    save();
  }
})();
