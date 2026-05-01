//GLOBAL CONFIG & STATE
let ROWS, COLS, world, agent, kb, metrics, autoTimer = null, stepSpeed = 450, autoRunning = false;
const DIRS = [{ dr: -1, dc: 0 }, { dr: 1, dc: 0 }, { dr: 0, dc: -1 }, { dr: 0, dc: 1 }];
const STATUS_BASE = "w-full px-4 py-3 text-center font-mono text-xs border-t border-slate-100 transition-colors";
const STATUS_VARIANTS = {
  default: "bg-slate-50 text-slate-400",
  running: "bg-sky-50/50 text-sky-600",
  dead: "bg-rose-50 text-rose-600",
  won: "bg-emerald-50 text-emerald-600"
};
const LOG_CLASS_MAP = {
  "log-safe": "text-emerald-600",
  "log-danger": "text-rose-600",
  "log-move": "text-blue-600"
};

//UI & INTERACTION LOGIC
function openSettings() {
  document.getElementById('settings-modal').classList.remove('hidden');
}

function closeSettings() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function switchTab(id) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.add('hidden'));
  document.getElementById(`pane-${id}`).classList.remove('hidden');
  
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('bg-white', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
    b.classList.add('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-100/50');
  });
  
  const btn = document.getElementById(`tab-${id}`);
  btn.classList.add('bg-white', 'text-slate-900', 'shadow-sm', 'border', 'border-slate-200');
  btn.classList.remove('text-slate-500', 'hover:text-slate-700', 'hover:bg-slate-100/50');
}

function syncAutoButton() {
  const btn = document.getElementById("auto-btn");
  if (autoRunning) {
    btn.className = "inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-transparent px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900";
    btn.innerHTML = `${lucideIcon("pause", "h-4 w-4")}`;
  } else {
    btn.className = "inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50";
    btn.innerHTML = `${lucideIcon("play", "h-4 w-4")}`;
  }
  refreshIcons();
}

function renderAll() {
  const grid = document.getElementById("grid");
  grid.style.gridTemplateColumns = `repeat(${COLS}, minmax(0, 1fr))`;
  grid.innerHTML = "";
  const reveal = !agent.alive || agent.won;
  for (let r = ROWS - 1; r >= 0; r--) for (let c = 0; c < COLS; c++) {
    const cell = document.createElement("div");
    cell.className = "relative flex h-[72px] w-[72px] flex-col items-center justify-center rounded-md border font-mono transition-colors";
    const key = k(r, c), isA = agent.r === r && agent.c === c, isV = agent.visited.has(key), isS = agent.safe.has(key);
    const iP = agent.inferredPit.has(key), iW = agent.inferredWumpus.has(key);
    if (reveal && world.pits[r][c]) cell.classList.add("border-rose-300", "bg-rose-50");
    else if (reveal && world.wumpus[r][c]) cell.classList.add("border-amber-300", "bg-amber-50");
    else if (isV) cell.classList.add("border-slate-200", "bg-white");
    else if (isS) cell.classList.add("border-emerald-300", "bg-emerald-50");
    else cell.classList.add("border-slate-200", "bg-slate-100");
    if (isA) cell.classList.add("border-sky-300", "ring-2", "ring-sky-200");

    const coord = document.createElement("div");
    coord.className = "absolute left-1.5 top-1 text-[8px] text-slate-400";
    coord.textContent = `${r + 1},${c + 1}`;
    cell.appendChild(coord);

    const icon = document.createElement("div");
    icon.className = "relative flex h-8 w-8 items-center justify-center text-slate-800";
    
    if (isA) {
      if (!agent.alive) {
        const hazType = world.pits[r][c] ? "circle-dot" : (world.wumpus[r][c] ? "ghost" : null);
        if (hazType) {
          const bgHaz = document.createElement("div");
          bgHaz.className = "absolute inset-0 flex items-center justify-center opacity-25 scale-125 text-rose-500/50";
          bgHaz.innerHTML = lucideIcon(hazType, "h-6 w-6");
          icon.appendChild(bgHaz);
        }
      }
      const agentIcon = document.createElement("div");
      agentIcon.className = "relative z-10";
      agentIcon.innerHTML = lucideIcon(agent.alive ? "bot" : "skull", "h-5 w-5");
      icon.appendChild(agentIcon);
    }
    else if (reveal && world.pits[r][c]) icon.innerHTML = lucideIcon("circle-dot", "h-5 w-5");
    else if (reveal && world.wumpus[r][c]) icon.innerHTML = lucideIcon("ghost", "h-5 w-5");
    else if (isV && world.gold[r][c] && agent.won) icon.innerHTML = lucideIcon("trophy", "h-5 w-5");
    cell.appendChild(icon);

    if (!isV && !isA) {
      const inf = document.createElement("div");
      inf.className = "absolute right-1 top-1";
      if (iP || iW) inf.innerHTML = lucideIcon("triangle-alert", "h-3 w-3 text-rose-600");
      else if (isS) inf.innerHTML = lucideIcon("badge-check", "h-3 w-3 text-emerald-600");
      cell.appendChild(inf);
    }

    if (isV && !isA) {
      const p = getPercepts(r, c);
      if (p.breeze || p.stench || p.glitter) {
        const pi = document.createElement("div");
        pi.className = "absolute bottom-1 flex items-center gap-0.5 text-slate-500";
        if (p.breeze) pi.innerHTML += lucideIcon("wind", "h-2.5 w-2.5");
        if (p.stench) pi.innerHTML += lucideIcon("cloud", "h-2.5 w-2.5");
        if (p.glitter) pi.innerHTML += lucideIcon("sparkles", "h-2.5 w-2.5");
        cell.appendChild(pi);
      }
    }
    grid.appendChild(cell);
  }
  refreshIcons();
}

function updatePercepts(r, c, p) {
  const box = document.getElementById("percepts-box");
  box.innerHTML = "";
  let any = false;
  if (p.stench) { box.innerHTML += badge("cloud", "Stench", "border-orange-200 bg-orange-50 text-orange-700"); any = true; }
  if (p.breeze) { box.innerHTML += badge("wind", "Breeze", "border-blue-200 bg-blue-50 text-blue-700"); any = true; }
  if (p.glitter) { box.innerHTML += badge("sparkles", "Glitter", "border-amber-200 bg-amber-50 text-amber-700"); any = true; }
  if (!any) box.innerHTML = '<span class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-400">None</span>';
  refreshIcons();
}

function updateMetrics() {
  document.getElementById("m-infer").textContent = metrics.inferSteps;
  document.getElementById("m-visited").textContent = agent.visited.size;
  document.getElementById("m-safe").textContent = metrics.safeProven;
  document.getElementById("m-kb").textContent = kb.length;
}

function updateKBDisplay() {
  const el = document.getElementById("kb-display");
  if (!kb.length) { el.textContent = "-"; return; }
  el.innerHTML = kb.slice(-50).map(cl => [...cl].map(l => {
    const n = l.startsWith("~");
    const pts = (n ? l.slice(1) : l).split("_");
    return `${n ? "~" : ""}${pts[0]}(${+pts[1] + 1},${+pts[2] + 1})`;
  }).join(" v ")).join("<br>");
  el.scrollTop = el.scrollHeight;
}

function setStatus(msg, cls) {
  const el = document.getElementById("status-bar");
  el.className = `${STATUS_BASE} ${STATUS_VARIANTS[cls] || STATUS_VARIANTS.default}`;
  el.textContent = msg;
}

function log(msg, cls = "") {
  const el = document.getElementById("log"), d = document.createElement("div");
  if (cls) d.className = LOG_CLASS_MAP[cls] || "";
  d.textContent = msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 150) el.removeChild(el.firstChild);
}

function badge(icon, label, colors) {
  return `<span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium ${colors}">${lucideIcon(icon, "h-3 w-3")}<span>${label}</span></span>`;
}

function lucideIcon(name, classes) {
  return `<i data-lucide="${name}" class="${classes}"></i>`;
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// Global UI Listeners
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSettings(); });
document.getElementById('settings-modal')?.addEventListener('click', (e) => { if (e.target === document.getElementById('settings-modal')) closeSettings(); });


//GAME ENGINE & AGENT LOGIC
function initGame() {
  stopAuto();
  ROWS = Math.max(3, Math.min(8, parseInt(document.getElementById("rows").value) || 4));
  COLS = Math.max(3, Math.min(8, parseInt(document.getElementById("cols").value) || 4));
  world = { pits: grid2d(false), wumpus: grid2d(false), gold: grid2d(false) };
  const cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!(r === 0 && c === 0)) cells.push([r, c]);
  shuffle(cells);
  const np = Math.max(1, Math.floor(cells.length * 0.18));
  for (let i = 0; i < np; i++) world.pits[cells[i][0]][cells[i][1]] = true;
  world.wumpus[cells[np][0]][cells[np][1]] = true;
  world.gold[cells[np + 1][0]][cells[np + 1][1]] = true;
  agent = { r: 0, c: 0, visited: new Set(), safe: new Set(), inferredPit: new Set(), inferredWumpus: new Set(), hasGold: false, alive: true, won: false };
  kb = [];
  metrics = { inferSteps: 0, safeProven: 0 };
  document.getElementById("log").innerHTML = "";
  log("Episode started", "log-move");
  visitCell(0, 0);
  renderAll();
  setStatus("Agent initialized", "running");
}

function visitCell(r, c) {
  const key = k(r, c);
  if (agent.visited.has(key)) return;
  agent.visited.add(key);
  if (world.pits[r][c] || world.wumpus[r][c]) {
    agent.alive = false;
    const msg = world.pits[r][c] ? "Fell into pit" : "Eaten by Wumpus";
    log(`${msg} at (${r + 1},${c + 1})`, "log-danger");
    setStatus(msg, "dead");
    stopAuto();
    renderAll();
    return;
  }
  if (world.gold[r][c] && !agent.hasGold) {
    agent.hasGold = true;
    agent.won = true;
    log(`Gold at (${r + 1},${c + 1})`, "log-safe");
    setStatus("Gold retrieved - mission complete", "won");
    stopAuto();
  }
  const p = getPercepts(r, c);
  tellKB(r, c, p);
  runInference();
}

function getPercepts(r, c) {
  let b = false, s = false, g = false;
  for (const { dr, dc } of DIRS) {
    const nr = r + dr, nc = c + dc;
    if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
      if (world.pits[nr][nc]) b = true;
      if (world.wumpus[nr][nc]) s = true;
    }
  }
  if (world.gold[r][c]) g = true;
  return { breeze: b, stench: s, glitter: g };
}

function tellKB(r, c, { breeze, stench }) {
  const adj = getAdj(r, c);
  if (!breeze) for (const [nr, nc] of adj) addClause([`~P_${nr}_${nc}`]);
  else if (adj.length) addClause(adj.map(([nr, nc]) => `P_${nr}_${nc}`));
  if (!stench) for (const [nr, nc] of adj) addClause([`~W_${nr}_${nc}`]);
  else if (adj.length) addClause(adj.map(([nr, nc]) => `W_${nr}_${nc}`));
  updateKBDisplay();
  updatePercepts(r, c, getPercepts(r, c));
}

function runInference() {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const key = k(r, c);
    if (agent.visited.has(key)) continue;
    const np = askKB(`~P_${r}_${c}`), nw = askKB(`~W_${r}_${c}`);
    const hp = askKB(`P_${r}_${c}`), hw = askKB(`W_${r}_${c}`);
    if (np && nw) {
      if (!agent.safe.has(key)) {
        agent.safe.add(key);
        metrics.safeProven++;
        log(`Safe: (${r + 1},${c + 1})`, "log-safe");
      }
      agent.inferredPit.delete(key);
      agent.inferredWumpus.delete(key);
    } else {
      if (hp) agent.inferredPit.add(key);
      if (hw) agent.inferredWumpus.add(key);
    }
  }
  updateMetrics();
}

function stepAgent() {
  if (!agent.alive || agent.won) return;
  const { r, c } = agent;
  const adj = getAdj(r, c).filter(([nr, nc]) => !agent.visited.has(k(nr, nc)));
  let moved = false;
  for (const [nr, nc] of adj) if (agent.safe.has(k(nr, nc))) {
    log(`-> (${nr + 1},${nc + 1}) safe`, "log-move");
    agent.r = nr; agent.c = nc;
    visitCell(nr, nc);
    moved = true;
    break;
  }
  if (!moved) {
    const t = findSafeUnvisited();
    if (t) {
      const p = bfsPath(r, c, t[0], t[1]);
      if (p && p.length) {
        const [nr, nc] = p[0];
        log(`-> (${nr + 1},${nc + 1}) navigate`, "log-move");
        agent.r = nr; agent.c = nc;
        visitCell(nr, nc);
        moved = true;
      }
    }
  }
  if (!moved) {
    const brave = adj.filter(([nr, nc]) => !agent.inferredPit.has(k(nr, nc)) && !agent.inferredWumpus.has(k(nr, nc)));
    if (brave.length) {
      const [nr, nc] = brave[0 | Math.random() * brave.length];
      log(`-> (${nr + 1},${nc + 1}) brave`, "log-danger");
      agent.r = nr; agent.c = nc;
      visitCell(nr, nc);
      moved = true;
    } else {
      log("No safe move - episode stalled", "log-danger");
      setStatus("No safe moves remaining", "default");
      stopAuto();
    }
  }
  renderAll();
  updateMetrics();
}

function findSafeUnvisited() {
  for (const key of agent.safe) if (!agent.visited.has(key)) {
    const [r, c] = key.split("_").map(Number);
    return [r, c];
  }
  return null;
}

function bfsPath(sr, sc, tr, tc) {
  const q = [[sr, sc, []]], seen = new Set([k(sr, sc)]);
  while (q.length) {
    const [r, c, p] = q.shift();
    for (const { dr, dc } of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      const nk = k(nr, nc);
      if (seen.has(nk)) continue;
      seen.add(nk);
      const np = [...p, [nr, nc]];
      if (nr === tr && nc === tc) return np;
      if (agent.visited.has(nk) || agent.safe.has(nk)) q.push([nr, nc, np]);
    }
  }
  return null;
}

function toggleAuto() {
  if (autoRunning) { stopAuto(); return; }
  if (!agent.alive || agent.won) { initGame(); return; }
  autoRunning = true;
  syncAutoButton();
  autoTimer = setInterval(() => {
    if (!agent.alive || agent.won) { stopAuto(); return; }
    stepAgent();
  }, stepSpeed);
}

function stopAuto() {
  if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  autoRunning = false;
  syncAutoButton();
}

function setSpeed(s, btn) {
  stepSpeed = s;
  document.querySelectorAll(".speed-btn").forEach(b => {
    b.classList.remove("bg-slate-900", "text-white");
    b.classList.add("text-slate-500");
    if (!b.classList.contains("hover:bg-slate-50")) b.classList.add("hover:bg-slate-50", "hover:text-slate-900");
  });
  btn.classList.add("bg-slate-900", "text-white");
  btn.classList.remove("text-slate-500", "hover:bg-slate-50", "hover:text-slate-900");
  if (autoRunning) { stopAuto(); toggleAuto(); }
}

// Logic Helpers
function addClause(lits) {
  const ns = new Set(lits);
  for (const cl of kb) if (isSubset(cl, ns)) return;
  for (let i = kb.length - 1; i >= 0; i--) if (isSubset(ns, kb[i])) kb.splice(i, 1);
  kb.push(ns);
}
function askKB(query) {
  metrics.inferSteps++;
  const testKB = [...kb.map(cl => new Set(cl)), new Set([neg(query)])];
  return resolve(testKB);
}
function resolve(clauses) {
  const seen = new Set(), ser = cl => [...cl].sort().join(",");
  let cur = clauses.map(cl => new Set(cl));
  for (let it = 0; it < 2000; it++) {
    const nw = [];
    for (let i = 0; i < cur.length; i++) for (let j = i + 1; j < cur.length; j++) for (const r of resolvePair(cur[i], cur[j])) {
      if (r.size === 0) return true;
      const s = ser(r);
      if (!seen.has(s)) { seen.add(s); nw.push(r); }
    }
    if (!nw.length) return false;
    for (const c of nw) cur.push(c);
  }
  return false;
}
function resolvePair(c1, c2) {
  const res = [];
  for (const l of c1) if (c2.has(neg(l))) {
    const r = new Set([...c1, ...c2]);
    r.delete(l); r.delete(neg(l));
    let t = false;
    for (const x of r) if (r.has(neg(x))) { t = true; break; }
    if (!t) res.push(r);
  }
  return res;
}
function grid2d(v) { return Array.from({ length: ROWS }, () => Array(COLS).fill(v)); }
function isSubset(a, b) { for (const x of a) if (!b.has(x)) return false; return true; }
function neg(l) { return l.startsWith("~") ? l.slice(1) : `~${l}`; }
function k(r, c) { return `${r}_${c}`; }
function getAdj(r, c) { return DIRS.map(({ dr, dc }) => [r + dr, c + dc]).filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = 0 | Math.random() * (i + 1); [a[i], a[j]] = [a[j], a[i]]; } }

// Bootstrap
initGame();
refreshIcons();