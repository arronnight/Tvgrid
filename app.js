const SPELUNKR_BASE = "https://jbuopkuluyfjwgsrigry.supabase.co/storage/v1/object/public/broadcast/";
const ARCHIVE_BASE = "https://archive.org/download/";
const EPOCH = 1577836800000;

const LOCAL_CONTENT = [
  ["Local News","Community news bulletin","sttvmi-NEWS_9.24.2018_-_TARA_S_WALK"],
  ["Local Government","City council and public meetings","ffmcia-City_Council_2-24-20"],
  ["Community Access","Public access television","planning-board-september-28-2016_202511"],
  ["Local Events","Town events and gatherings","orcavt-Montpelier_Community_Carol_Sing_-_December_9_2023_MCCS"],
  ["Local Sports","Area sports and school games","07.11.2023_Marshall_City_Council_Meeting"],
  ["Local History","Regional history and stories","nh-outlook-2002-01-21"],
  ["Local Culture","Local arts and culture","policing-with-the-people-june-2-2025"],
  ["Local Music","Area musicians and performances","trcwi-City_of_Ripon_Common_Council_08-25-25"],
  ["Neighborhood","Neighborhood stories","vmawi-Eau_Claire_City_Council_Meeting_-_September_24_25_2018"],
  ["Local Voices","Community voices and interviews","pacmd-Wicomico_County_Executive_Press_Conference_09_19_24"]
];

const ALL_CHANNELS = window.CHANNELS.slice();
const BASE_COUNT = ALL_CHANNELS.filter(c => !c.premium).length;
let premium = false;
let channels = ALL_CHANNELS.filter(c => !c.premium);
let current = null;
let activeGroup = null;
let cleanupPlayer = null;
let spelunkrLineup = null;
let spelunkrManifests = {};
let activeSpelunkr = null;
let archiveMeta = {};

const mount = document.getElementById("playerMount");
const overlay = document.getElementById("playerOverlay");
const epgModal = document.getElementById("epgModal");

function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
}
function fmt(d) {
  return new Date(d).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function pad(n) { return String(n).padStart(2, "0"); }

function setOverlay(text, isError) {
  overlay.style.display = "flex";
  overlay.textContent = text;
  overlay.classList.toggle("error", !!isError);
}

function clearPlayer() {
  if (cleanupPlayer) {
    try { cleanupPlayer(); } catch (e) {}
    cleanupPlayer = null;
  }
  mount.querySelectorAll("video, iframe, .player-msg").forEach(el => el.remove());
  overlay.style.display = "none";
  activeSpelunkr = null;
}

function makeVideo() {
  const v = document.createElement("video");
  v.controls = true;
  v.muted = true;
  v.autoplay = true;
  v.playsInline = true;
  mount.appendChild(v);
  return v;
}

function mountIframe(src) {
  overlay.style.display = "none";
  const f = document.createElement("iframe");
  f.src = src;
  f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  f.allowFullscreen = true;
  mount.appendChild(f);
}

function mountExternal(c) {
  const box = document.createElement("div");
  box.className = "player-msg";
  box.innerHTML = `<p>This source blocks embedded playback.</p><a href="${esc(c.src)}" target="_blank" rel="noopener">Open ${esc(c.name)} in a new tab</a>`;
  mount.appendChild(box);
}

function mountFlv(url) {
  overlay.style.display = "none";
  const v = makeVideo();
  if (!window.flvjs || !flvjs.isSupported()) {
    setOverlay("FLV playback is not supported in this browser.", true);
    return;
  }
  const player = flvjs.createPlayer({ type: "flv", url, isLive: true, hasAudio: true, hasVideo: true }, {
    enableWorker: false,
    enableStashBuffer: false,
    autoCleanupSourceBuffer: true
  });
  player.attachMediaElement(v);
  player.load();
  player.play().catch(() => {});
  player.on(flvjs.Events.ERROR, () => setOverlay("Stream unavailable. Try another channel.", true));
  cleanupPlayer = () => {
    player.pause();
    player.unload();
    player.detachMediaElement();
    player.destroy();
  };
}

function mountHls(url) {
  overlay.style.display = "none";
  const v = makeVideo();
  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: true });
    hls.loadSource(url);
    hls.attachMedia(v);
    hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.fatal) setOverlay("Stream unavailable. Try another channel.", true);
    });
    cleanupPlayer = () => hls.destroy();
  } else if (v.canPlayType("application/vnd.apple.mpegurl")) {
    v.src = url;
    v.play().catch(() => {});
  } else {
    setOverlay("HLS playback is not supported in this browser.", true);
  }
}

function mountVideo(src, startAt, onEnded) {
  overlay.style.display = "none";
  const v = makeVideo();
  v.addEventListener("loadedmetadata", () => {
    if (startAt > 0 && isFinite(v.duration) && startAt < v.duration) {
      try { v.currentTime = startAt; } catch (e) {}
    }
    v.play().catch(() => {});
  });
  v.addEventListener("ended", () => { if (onEnded) onEnded(); });
  v.addEventListener("error", () => setOverlay("Video unavailable. Trying next…", true));
  v.src = src;
  cleanupPlayer = () => { v.pause(); v.removeAttribute("src"); v.load(); };
}

function archiveUrl(item) {
  const raw = item.file || item.mp4 || item.url;
  if (!raw) return null;
  if (/^https?:/i.test(raw)) return raw;
  const file = raw.split("/").map(encodeURIComponent).join("/");
  return ARCHIVE_BASE + encodeURIComponent(item.id) + "/" + file;
}

/* ---------- schedules ---------- */

function scheduleFor(manifest, version, now) {
  const items = manifest.items;
  const total = items.reduce((s, i) => s + (i.duration || 0), 0) * 1000;
  if (!items.length || !total) return null;
  let phase = ((now - version.epochMs) % total + total) % total;
  let idx = ((version.startIndex || 0) % items.length + items.length) % items.length;
  while (phase >= items[idx].duration * 1000) {
    phase -= items[idx].duration * 1000;
    idx = (idx + 1) % items.length;
  }
  return { item: items[idx], index: idx, offset: phase, total };
}

function latestVersion(ch) {
  const now = Date.now();
  const vs = (ch.versions || []).slice().sort((a, b) => b.v - a.v);
  return vs.find(v => (v.effectiveAtMs || 0) <= now) || vs[0];
}

async function getLineup() {
  if (spelunkrLineup) return spelunkrLineup;
  const r = await fetch(SPELUNKR_BASE + "lineup.json", { cache: "no-store" });
  if (!r.ok) throw new Error("lineup " + r.status);
  spelunkrLineup = await r.json();
  return spelunkrLineup;
}

async function getManifest(path) {
  if (spelunkrManifests[path]) return spelunkrManifests[path];
  const r = await fetch(SPELUNKR_BASE + path, { cache: "no-store" });
  if (!r.ok) throw new Error("manifest " + r.status);
  const m = await r.json();
  spelunkrManifests[path] = m;
  return m;
}

function archiveEntryAt(c, t) {
  const s = c.schedule || [];
  if (!s.length) return null;
  const total = s.reduce((a, b) => a + (b.duration || 0), 0) * 1000;
  if (!total) return null;
  let phase = ((t - (c.epoch || EPOCH)) % total + total) % total;
  let idx = 0;
  while (phase >= s[idx].duration * 1000) {
    phase -= s[idx].duration * 1000;
    idx = (idx + 1) % s.length;
  }
  const start = t - phase;
  return { item: s[idx], index: idx, offset: phase, start, end: start + s[idx].duration * 1000 };
}

function archiveEntries(c, from, to) {
  const out = [];
  let cursor = from;
  let guard = 0;
  while (cursor < to && guard++ < 400) {
    const e = archiveEntryAt(c, cursor);
    if (!e) break;
    if (e.end > from) out.push(Object.assign({}, e, { start: Math.max(e.start, from) }));
    if (e.end <= cursor) break;
    cursor = e.end;
  }
  return out;
}

function spelunkrInfo(c) {
  const ch = spelunkrLineup && spelunkrLineup.channels.find(x => x.id === c.slug);
  if (!ch) return null;
  const ver = latestVersion(ch);
  const manifest = ver && spelunkrManifests[ver.manifest];
  return manifest ? { ch, ver, manifest } : null;
}

function spelunkrEntries(c, from, to) {
  const info = spelunkrInfo(c);
  if (!info) return [];
  const out = [];
  let cursor = from;
  let guard = 0;
  while (cursor < to && guard++ < 400) {
    const s = scheduleFor(info.manifest, info.ver, cursor);
    if (!s || !(s.item.duration > 0)) break;
    const start = cursor - s.offset;
    const end = start + s.item.duration * 1000;
    if (end > from) out.push({ item: s.item, start: Math.max(start, from), end });
    if (end <= cursor) break;
    cursor = end;
  }
  return out;
}

function liveEntries(c, from, to) {
  const block = 30 * 60000;
  const labels = {
    "Vaughn Live": ["Live Stream", "Viewer Requests", "Community Block", "Late Night Live"],
    "Retro": ["Retro Block", "Classic Hour", "Throwback", "Late Night Retro"]
  };
  const list = labels[c.category] || ["Live Programming"];
  const out = [];
  let start = Math.floor(from / block) * block;
  let i = 0;
  while (start < to && i < 50) {
    const hour = new Date(start).getHours();
    out.push({ item: { title: list[hour % list.length] }, start, end: start + block, live: true });
    start += block;
    i++;
  }
  return out;
}

function entriesFor(c, from, to) {
  if (c.mode === "archive") return archiveEntries(c, from, to);
  if (c.mode === "spelunkr") return spelunkrEntries(c, from, to);
  return liveEntries(c, from, to);
}

function entryAt(c, t) {
  if (c.mode === "archive") return archiveEntryAt(c, t);
  if (c.mode === "spelunkr") {
    const info = spelunkrInfo(c);
    if (!info) return null;
    const s = scheduleFor(info.manifest, info.ver, t);
    if (!s) return null;
    const start = t - s.offset;
    return { item: s.item, offset: s.offset, start, end: start + s.item.duration * 1000 };
  }
  return null;
}

/* ---------- playback ---------- */

async function archiveVideoUrl(id) {
  let meta = archiveMeta[id];
  if (!meta) {
    const r = await fetch("https://archive.org/metadata/" + encodeURIComponent(id), { cache: "no-store" });
    if (!r.ok) throw new Error("metadata " + r.status);
    meta = await r.json();
    archiveMeta[id] = meta;
  }
  const files = (meta.files || []).filter(f => /\.mp4$/i.test(f.name || ""));
  if (!files.length) throw new Error("no video file");
  const preferred = files.filter(f => /h\.264/i.test(f.format || "") || /\.ia\.mp4$/i.test(f.name));
  const pick = (preferred.length ? preferred : files)[Math.floor(Date.now() / 3600000) % (preferred.length ? preferred.length : files.length)];
  return "https://archive.org/download/" + encodeURIComponent(id) + "/" + encodeURIComponent(pick.name);
}

async function playArchiveChannel(c, entry) {
  if (current !== c) return;
  const e = entry || archiveEntryAt(c, Date.now());
  if (!e) { setOverlay("No schedule for this channel.", true); return; }
  setOverlay("Loading from archive.org…");
  try {
    const url = await archiveVideoUrl(e.item.id);
    if (current !== c) return;
    document.getElementById("nowPlaying").textContent = `NOW: ${e.item.title || "Archive Program"}`;
    document.getElementById("openTab").href = "https://archive.org/details/" + e.item.id;
    mountVideo(url, (e.offset || 0) / 1000, () => {
      if (current !== c) return;
      playArchiveChannel(c, archiveEntryAt(c, e.end + 1000));
    });
  } catch (err) {
    if (current === c) setOverlay("Could not load this program. Try another channel.", true);
  }
}

async function playSpelunkr(c) {
  setOverlay("Loading schedule…");
  const lineup = await getLineup();
  const ch = lineup.channels.find(x => x.id === c.slug);
  if (!ch) throw new Error("channel not found");
  const version = latestVersion(ch);
  if (!version) throw new Error("no schedule");
  const manifest = await getManifest(version.manifest);
  activeSpelunkr = { channel: ch, version, manifest };
  const sched = scheduleFor(manifest, version, Date.now());
  if (!sched) throw new Error("empty schedule");
  playSpelunkrItem(sched.index, sched.offset);
}

function playSpelunkrItem(index, offset) {
  if (!activeSpelunkr) return;
  const items = activeSpelunkr.manifest.items;
  let tries = 0;
  let idx = index;
  while (tries < items.length) {
    const item = items[idx % items.length];
    const url = archiveUrl(item);
    if (url) {
      const next = (idx + 1) % items.length;
      document.getElementById("nowPlaying").textContent = `NOW: ${item.title || "Spelunkr"}`;
      document.getElementById("openTab").href = "https://archive.org/details/" + item.id;
      mountVideo(url, (offset || 0) / 1000, () => playSpelunkrItem(next, 0));
      return;
    }
    idx = (idx + 1) % items.length;
    tries++;
  }
  setOverlay("No playable item in this schedule.", true);
}

async function playChannel(c) {
  if (!c) return;
  current = c;
  clearPlayer();
  document.getElementById("channelTitle").textContent = `${pad(c.number)} ${c.name}`;
  document.getElementById("channelDesc").textContent = c.description;
  document.getElementById("openTab").href = c.src;
  document.getElementById("nowPlaying").textContent = `NOW: ${c.name}`;
  renderChannels();
  closeEPG();
  try {
    if (c.mode === "flv") {
      mountFlv(`https://stream-cdn-iad3.vaughnsoft.net/play/live_${c.stream}.flv`);
    } else if (c.mode === "hls") {
      mountHls(c.src);
    } else if (c.mode === "spelunkr") {
      await playSpelunkr(c);
    } else if (c.mode === "archive") {
      await playArchiveChannel(c);
    } else if (c.mode === "iframe") {
      mountIframe(c.src);
    } else {
      mountExternal(c);
    }
  } catch (e) {
    setOverlay("Could not load this channel. Try another.", true);
  }
}

/* ---------- local channels ---------- */

function localItemsFromDocs(docs) {
  return docs.map(d => ({ id: d.identifier, title: (d.title || "Local Programming").replace(/\s+/g, " ").slice(0, 80) }))
             .filter(d => d.id);
}

function localItemsFallback() {
  return LOCAL_CONTENT.map(x => ({ id: x[2], title: x[0] + " — " + x[1] }));
}

function applyLocal(items, city, region) {
  const label = city || region || "your area";
  const base = items.length >= 4 ? items : items.concat(localItemsFallback());
  for (let i = 0; i < 10; i++) {
    const c = ALL_CHANNELS[i];
    if (!c) continue;
    const rotated = base.slice(i % base.length).concat(base.slice(0, i % base.length));
    const schedule = rotated.slice(0, 14).map((it, n) => ({ id: it.id, title: it.title, duration: n % 3 === 0 ? 1800 : 2700 }));
    c.schedule = schedule;
    c.epoch = EPOCH + i * 60000;
    c.ident = schedule[0].id;
    c.src = "https://archive.org/details/" + schedule[0].id;
    c.description = `Local programming for ${label}`;
  }
  renderChannels();
  renderEPG();
}

async function detectGeo() {
  let code = "US", city = "", region = "";
  try {
    const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    code = (j.country_code || "US").toUpperCase();
    city = j.city || "";
    region = j.region || "";
  } catch (e) {}
  let docs = [];
  const clean = v => String(v || "").replace(/["\\]/g, "").trim();
  if (clean(city) || clean(region)) {
    const q = `(title:("${clean(city)}") OR title:("${clean(region)}")) AND collection:community_media AND mediatype:movies`;
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&rows=30&output=json`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      docs = (j.response && j.response.docs || []).filter(d => d.identifier);
    } catch (e) {}
  }
  applyLocal(docs.length ? localItemsFromDocs(docs) : localItemsFallback(), city, region);
  document.getElementById("geoBtn").textContent = `Location: ${city ? city + ", " : ""}${code}`;
  renderGroups();
  renderChannels();
  renderEPG();
}

/* ---------- UI ---------- */

function renderChannels() {
  const q = (document.getElementById("search").value || "").toLowerCase();
  const list = document.getElementById("channelList");
  list.innerHTML = "";
  const visible = channels
    .filter(c => !activeGroup || c.group === activeGroup)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  visible.forEach(c => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ch-num">${pad(c.number)}</span><span class="ch-name">${esc(c.name)}</span><span class="ch-cat">${esc(c.category)}</span>`;
    li.onclick = () => playChannel(c);
    if (current && current.number === c.number) li.classList.add("active");
    list.appendChild(li);
  });
  document.getElementById("channelCount").textContent = `${visible.length} / ${channels.length} CHANNELS`;
}

function renderGroups() {
  const groupsEl = document.getElementById("groups");
  groupsEl.innerHTML = "";
  const groups = {};
  channels.forEach(c => { groups[c.group] = (groups[c.group] || 0) + 1; });
  const mk = (label, value) => {
    const btn = document.createElement("button");
    btn.className = "group-btn" + ((value === null && activeGroup === null) || value === activeGroup ? " active" : "");
    btn.textContent = label;
    btn.onclick = () => { activeGroup = value; renderGroups(); renderChannels(); renderEPG(); };
    groupsEl.appendChild(btn);
  };
  mk("ALL", null);
  Object.keys(groups).forEach(g => mk(g.toUpperCase(), g));
}

function setPremium(on) {
  premium = !!on;
  channels = ALL_CHANNELS.filter(c => premium || !c.premium);
  if (current && !channels.some(c => c.number === current.number)) {
    current = null;
    clearPlayer();
    setOverlay("Premium disabled. Select a channel");
    document.getElementById("channelTitle").textContent = "—";
    document.getElementById("channelDesc").textContent = "—";
  }
  if (activeGroup && !channels.some(c => c.group === activeGroup)) activeGroup = null;
  const btn = document.getElementById("premiumBtn");
  btn.textContent = premium ? "Premium ON" : "Premium";
  btn.classList.toggle("active", premium);
  document.getElementById("channelTitle") && (document.getElementById("channelTitle").dataset.premium = premium ? "1" : "");
  renderGroups();
  renderChannels();
  renderEPG();
}

/* ---------- EPG ---------- */

const PX_PER_MIN = 4;
const EPG_WINDOW_MIN = 180;
const CH_W = 180;

function openEPG() {
  epgModal.classList.add("open");
  renderEPG();
}
function closeEPG() {
  epgModal.classList.remove("open");
}

function renderEPG() {
  if (!epgModal.classList.contains("open")) return;
  const scroller = document.getElementById("epgScroll");
  const keepLeft = scroller.scrollLeft, keepTop = scroller.scrollTop;
  const now = Date.now();
  const windowStart = Math.floor(now / 1800000) * 1800000 - 30 * 60000;
  const windowEnd = windowStart + EPG_WINDOW_MIN * 60000;
  const windowPx = EPG_WINDOW_MIN * PX_PER_MIN;
  const nowPx = Math.max(0, Math.min(windowPx, (now - windowStart) / 60000 * PX_PER_MIN));
  document.getElementById("epgRange").textContent = `${fmt(windowStart)} – ${fmt(windowEnd)}`;

  let timebar = "";
  for (let m = 0; m <= EPG_WINDOW_MIN; m += 30) {
    const t = windowStart + m * 60000;
    timebar += `<div class="epg-tick" style="left:${m * PX_PER_MIN}px"><span>${fmt(t)}</span></div>`;
  }
  document.getElementById("epgTimebar").style.width = windowPx + "px";
  document.getElementById("epgTimebar").innerHTML = timebar;

  const list = channels.filter(c => !activeGroup || c.group === activeGroup);
  let rows = "";
  for (const c of list) {
    const entries = entriesFor(c, windowStart, windowEnd);
    let blocks = "";
    for (const e of entries) {
      const left = Math.max(0, (e.start - windowStart) / 60000 * PX_PER_MIN);
      const right = Math.min(windowPx, (e.end - windowStart) / 60000 * PX_PER_MIN);
      const width = Math.max(14, right - left);
      const isNow = now >= e.start && now < e.end;
      const title = (e.item && e.item.title) || "Program";
      const time = `${fmt(e.start)}–${fmt(e.end)}`;
      blocks += `<div class="epg-block${isNow ? " now" : ""}${e.live ? " live" : ""}" style="left:${left}px;width:${width}px" title="${esc(time + " • " + title)}"><span>${esc(title)}</span><em>${esc(time)}</em></div>`;
    }
    rows += `<div class="epg-row${current && current.number === c.number ? " active" : ""}" data-num="${c.number}"><div class="epg-ch"><span class="epg-num">${pad(c.number)}</span><span class="epg-name">${esc(c.name)}</span></div><div class="epg-track" style="width:${windowPx}px">${blocks}</div></div>`;
  }
  document.getElementById("epgRows").innerHTML = `<div class="epg-now" style="left:${CH_W + nowPx}px"></div>` + rows;
  scroller.scrollLeft = keepLeft;
  scroller.scrollTop = keepTop;
}

document.getElementById("epgTimebar")?.addEventListener("click", () => {});
document.getElementById("epgRows").addEventListener("click", e => {
  const row = e.target.closest(".epg-row");
  if (!row) return;
  const c = channels.find(x => x.number === Number(row.dataset.num));
  if (c) playChannel(c);
});

/* ---------- boot ---------- */

document.getElementById("search").addEventListener("input", renderChannels);
document.getElementById("epgToggle").addEventListener("click", openEPG);
document.getElementById("epgClose").addEventListener("click", closeEPG);
document.getElementById("epgModal").addEventListener("click", e => { if (e.target.id === "epgModal") closeEPG(); });
document.getElementById("geoBtn").addEventListener("click", detectGeo);
document.getElementById("premiumBtn").addEventListener("click", () => setPremium(!premium));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeEPG(); });

async function preloadSpelunkr() {
  try {
    const lineup = await getLineup();
    const queue = lineup.channels.slice();
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const ch = queue.shift();
        const ver = latestVersion(ch);
        if (!ver) continue;
        try { await getManifest(ver.manifest); } catch (e) {}
      }
    });
    await Promise.all(workers);
    renderEPG();
  } catch (e) {}
}

renderGroups();
renderChannels();
setPremium(false);
detectGeo();
preloadSpelunkr();
setInterval(() => { if (epgModal.classList.contains("open")) renderEPG(); }, 60000);
