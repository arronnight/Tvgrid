const SPELUNKR_BASE = "https://jbuopkuluyfjwgsrigry.supabase.co/storage/v1/object/public/broadcast/";
const ARCHIVE_BASE = "https://archive.org/download/";
const BASE_START = Date.parse("2024-01-01T00:00:00Z");

const LOCAL_CONTENT = [
  ["Retro Local News", "Local news broadcasts from the 90s and 2000s"],
  ["Retro Local News 2", "More local news broadcasts from the 90s and 2000s"],
  ["Retro Local Weather", "Local weather and community updates"],
  ["Retro Local Sports", "Local sports and school broadcasts"],
  ["Community Access", "Public access television from the 90s and 2000s"],
  ["Local Government", "City council and public meetings"],
  ["Local Events", "Town events and community gatherings"],
  ["Local History", "Regional history and stories"],
  ["Local Culture", "Local arts, music and culture"],
  ["Local Voices", "Community voices and interviews"]
];

const LOCAL_NEWS_FALLBACK = [
  "wbrtvmi-WBRW_News_September_23_2009_Pt._2",
  "wbrtvmi-2009_News_July_15_WBRW",
  "wbrtvmi-2009_News_July_15_Pt2",
  "cutvqc-ACSioN_Network_News_Episode_1_-_Part_1",
  "cutvqc-ACSioN_Network_News_Episode_1_-_Part_2",
  "copdca-Palmdale_-_ALPR_Press_Conference_Feb._22_2008",
  "copdca-Backdrop_Palmdale_10_-_Segment_4",
  "copdca-Backdrop_Palmdale_10_-_Segment_5",
  "vctv7bc-Valemount_Live_Episode_2_Part_3",
  "vctv7bc-Valemount_Live_Episode_1_Part_2",
  "bc18ma-Barnstable_Today_08_07_2009_10Min",
  "covtx-Nov_23_2009_News_Break"
];

let standardChannels = window.CHANNELS.slice();
let premiumChannels = window.PREMIUM_CHANNELS || [];
let premiumOn = true;
let channels = [];
let current = null;
let activeGroup = null;
let cleanupPlayer = null;
let playToken = 0;
let spelunkrLineup = null;
let spelunkrManifests = {};
let activeSpelunkr = null;
let archiveMetaCache = {};
let metaInflight = {};

const mount = document.getElementById("playerMount");
const overlay = document.getElementById("playerOverlay");

function rebuildChannels() {
  channels = premiumOn ? standardChannels.concat(premiumChannels) : standardChannels.slice();
  renderGroups();
  renderChannels();
  renderEPG();
}

function setOverlay(text, isError) {
  overlay.style.display = "flex";
  overlay.textContent = text;
  overlay.classList.toggle("error", !!isError);
}

function hideOverlay() {
  overlay.style.display = "none";
}

function clearPlayer() {
  if (cleanupPlayer) {
    try { cleanupPlayer(); } catch (e) {}
    cleanupPlayer = null;
  }
  mount.querySelectorAll("video, iframe, .player-msg").forEach(el => el.remove());
  hideOverlay();
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
  hideOverlay();
  const f = document.createElement("iframe");
  f.src = src;
  f.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  f.allowFullscreen = true;
  mount.appendChild(f);
}

function mountExternal(c) {
  const box = document.createElement("div");
  box.className = "player-msg";
  box.innerHTML = `<p>This source blocks embedded playback.</p><a href="${c.src}" target="_blank" rel="noopener">Open ${c.name} in a new tab</a>`;
  mount.appendChild(box);
  hideOverlay();
}

function mountFlv(url) {
  hideOverlay();
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
  hideOverlay();
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
  hideOverlay();
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

function calcPlaylist(items, startMs, startIndex, now) {
  if (!items || !items.length) return null;
  const total = items.reduce((s, i) => s + (i.duration || 0), 0);
  if (!total) return null;
  const totalMs = total * 1000;
  let phaseMs = ((now - startMs) % totalMs + totalMs) % totalMs;
  let idx = ((startIndex || 0) % items.length + items.length) % items.length;
  let guard = 0;
  while (phaseMs >= (items[idx].duration || 0) * 1000 && guard < items.length * 4) {
    phaseMs -= (items[idx].duration || 0) * 1000;
    idx = (idx + 1) % items.length;
    guard++;
  }
  const offset = phaseMs / 1000;
  return { item: items[idx], index: idx, offset, total, remaining: (items[idx].duration || 0) - offset };
}

function loadMeta(ident) {
  if (archiveMetaCache[ident]) return Promise.resolve(archiveMetaCache[ident]);
  if (metaInflight[ident]) return metaInflight[ident];
  metaInflight[ident] = fetch("https://archive.org/metadata/" + encodeURIComponent(ident), { cache: "no-store" })
    .then(r => { if (!r.ok) throw new Error("metadata " + r.status); return r.json(); })
    .then(j => { archiveMetaCache[ident] = j; delete metaInflight[ident]; return j; })
    .catch(e => { delete metaInflight[ident]; throw e; });
  return metaInflight[ident];
}

function cleanTitle(t) {
  let s = String(t || "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!/^(19|20)\d\d\b/.test(s)) s = s.replace(/^\d{3,5}\s+/, "");
  s = s.replace(/\b([A-Z][a-z]{2,8})\s+(\d{1,2})(\d{4})\b/g, "$1 $2, $3");
  return s;
}

function itemsFromMeta(ident, meta, minDuration) {
  const md = meta.metadata || {};
  let title = md.title;
  if (Array.isArray(title)) title = title[0];
  title = cleanTitle(title || ident);
  let year = md.year;
  if (Array.isArray(year)) year = year[0];
  year = String(year || "");
  const out = [];
  for (const f of (meta.files || [])) {
    const name = String(f.name || "");
    if (!/\.mp4$/i.test(name)) continue;
    if (f.private === true) continue;
    const low = name.toLowerCase();
    if (/segment|commercial|promo|trailer|clip|teaser|bumper/.test(low)) continue;
    const dur = parseFloat(f.length || 0) || 0;
    if (dur < (minDuration || 600)) continue;
    out.push({ id: ident, file: name, duration: dur, title, year });
  }
  return out.slice(0, 80);
}

async function ensureArchiveItems(c, minDuration) {
  if (c.items && c.items.length) return c.items;
  const meta = await loadMeta(c.ident);
  const items = itemsFromMeta(c.ident, meta, minDuration || 600);
  if (!items.length) throw new Error("no playable items");
  c.items = items;
  c.mode = "playlist";
  c.startMs = BASE_START + c.number * 3600000;
  c.startIndex = c.number % items.length;
  return items;
}

function playPlaylistItem(c, index, offset) {
  if (!c.items || !c.items.length) return;
  const item = c.items[index % c.items.length];
  const url = archiveUrl(item);
  if (!url) { playPlaylistItem(c, index + 1, 0); return; }
  document.getElementById("nowPlaying").textContent = `NOW: ${item.title}`;
  mountVideo(url, offset || 0, () => playPlaylistItem(c, (index + 1) % c.items.length, 0));
}

function playPlaylist(c) {
  const sched = calcPlaylist(c.items, c.startMs, c.startIndex, Date.now());
  if (!sched) throw new Error("empty playlist");
  playPlaylistItem(c, sched.index, sched.offset);
}

async function playArchive(c) {
  setOverlay("Loading from archive.org…");
  await ensureArchiveItems(c, 600);
  playPlaylist(c);
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

function spelunkrItems(manifest) {
  return manifest.items.map(it => ({
    id: it.id,
    file: it.file || it.mp4,
    duration: it.duration || 0,
    title: it.title || "Spelunkr",
    year: it.year || ""
  }));
}

async function playSpelunkr(c) {
  setOverlay("Loading schedule…");
  const lineup = await getLineup();
  const ch = lineup.channels.find(x => x.id === c.slug);
  if (!ch) throw new Error("channel not found");
  const version = latestVersion(ch);
  if (!version) throw new Error("no schedule");
  const manifest = await getManifest(version.manifest);
  const items = spelunkrItems(manifest);
  activeSpelunkr = { channel: ch, version, manifest, items };
  const sched = calcPlaylist(items, version.epochMs, version.startIndex, Date.now());
  if (!sched) throw new Error("empty schedule");
  playSpelunkrItem(sched.index, sched.offset);
}

function playSpelunkrItem(index, offset) {
  if (!activeSpelunkr) return;
  const items = activeSpelunkr.items;
  const item = items[index % items.length];
  const url = archiveUrl(item);
  if (!url) {
    playSpelunkrItem((index + 1) % items.length, 0);
    return;
  }
  document.getElementById("nowPlaying").textContent = `NOW: ${item.title}`;
  mountVideo(url, offset || 0, () => playSpelunkrItem((index + 1) % items.length, 0));
}

async function playChannel(c) {
  current = c;
  const token = ++playToken;
  clearPlayer();
  document.getElementById("channelTitle").textContent = `${String(c.number).padStart(2,"0")} ${c.name}`;
  document.getElementById("channelDesc").textContent = c.description;
  document.getElementById("openTab").href = c.src || (c.items && c.items[0] ? `https://archive.org/details/${c.items[0].id}` : "#");
  document.getElementById("nowPlaying").textContent = `NOW: ${c.name}`;
  renderChannels();
  renderEPG();
  try {
    if (c.mode === "flv") {
      mountFlv(`https://stream-cdn-iad3.vaughnsoft.net/play/live_${c.stream}.flv`);
    } else if (c.mode === "hls") {
      mountHls(c.src);
    } else if (c.mode === "spelunkr") {
      await playSpelunkr(c);
      if (token !== playToken) return;
    } else if (c.mode === "playlist") {
      playPlaylist(c);
    } else if (c.mode === "archive") {
      await playArchive(c);
      if (token !== playToken) return;
    } else if (c.mode === "iframe") {
      mountIframe(c.src);
    } else {
      mountExternal(c);
    }
  } catch (e) {
    if (token === playToken) setOverlay("Could not load this channel. Try another.", true);
  }
}

function localName(i, city, region) {
  const place = city || region || "Local";
  const base = LOCAL_CONTENT[i][0];
  return i === 0 ? `${place} Retro News` : `${place} ${base}`;
}

function applyLocalDocs(docs, city, region) {
  for (let i = 0; i < 10; i++) {
    const ident = docs[i % docs.length].identifier;
    const [name, desc] = LOCAL_CONTENT[i];
    Object.assign(standardChannels[i], {
      name: localName(i, city, region),
      description: `${desc}${city ? " — " + city : ""}`,
      mode: "archive",
      ident,
      items: null,
      startMs: null,
      startIndex: 0,
      src: `https://archive.org/details/${ident}`,
      category: "Local",
      group: "local"
    });
  }
}

async function buildLocalPlaylists(docs, city, region, token) {
  const unique = [];
  const seen = new Set();
  for (const d of docs) {
    if (!d || !d.identifier || seen.has(d.identifier)) continue;
    seen.add(d.identifier);
    unique.push(d);
    if (unique.length >= 12) break;
  }
  const pool = [];
  await Promise.all(unique.map(async d => {
    try {
      const meta = await loadMeta(d.identifier);
      const items = itemsFromMeta(d.identifier, meta, 300);
      if (items.length) pool.push(...items.slice(0, 3));
    } catch (e) {}
  }));
  if (!pool.length) return false;
  for (let i = 0; i < 10; i++) {
    const c = standardChannels[i];
    c.mode = "playlist";
    c.items = pool;
    c.startMs = BASE_START + i * 7 * 3600000;
    c.startIndex = (i * 3) % pool.length;
    c.name = localName(i, city, region);
    c.src = `https://archive.org/details/${c.ident}`;
  }
  if (token === playToken) {
    renderEPG();
    if (current && current.group === "local" && current.mode === "playlist") playPlaylist(current);
  }
  return true;
}

async function detectGeo() {
  let code = "US", city = "", region = "";
  try {
    const r = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) });
    const j = await r.json();
    code = (j.country_code || "US").toUpperCase();
    city = j.city || "";
    region = j.region || "";
  } catch (e) {}
  document.getElementById("geoBtn").textContent = `Location: ${city ? city + ", " : ""}${code}`;
  const clean = v => String(v || "").replace(/["\\]/g, "").trim();
  const isNews = d => /news|newscast|newsbreak|news break|today|update|report|weather|bulletin|brief/i.test(String(d.title || d.identifier || ""));
  const search = async q => {
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&rows=40&output=json`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) });
      const j = await r.json();
      return (j.response && j.response.docs || []).filter(d => d.identifier);
    } catch (e) { return []; }
  };
  let docs = [];
  if (clean(city) || clean(region)) {
    const q = `collection:community_media AND year:[1990 TO 2009] AND mediatype:movies AND language:(eng OR English) AND (title:("${clean(city)}") OR title:("${clean(region)}")) AND (title:(news) OR title:(newscast) OR subject:(news))`;
    docs = (await search(q)).filter(isNews);
  }
  if (docs.length < 3) {
    const q = `collection:community_media AND year:[1990 TO 2009] AND mediatype:movies AND language:(eng OR English) AND (title:(news) OR title:(newscast))`;
    docs = (await search(q)).filter(isNews);
  }
  if (docs.length < 3) docs = LOCAL_NEWS_FALLBACK.map(id => ({ identifier: id, title: id.replace(/[-_]/g, " ") }));
  docs.sort((a, b) => {
    const an = /newscast|news|today|update|report|weather/i.test(a.title || "") ? 0 : 1;
    const bn = /newscast|news|today|update|report|weather/i.test(b.title || "") ? 0 : 1;
    return an - bn;
  });
  applyLocalDocs(docs, city, region);
  renderChannels();
  renderEPG();
  const ok = await buildLocalPlaylists(docs, city, region, playToken);
  if (!ok) applyLocalDocs(docs, city, region);
  renderChannels();
  renderEPG();
}

function renderChannels() {
  const q = (document.getElementById("search").value || "").toLowerCase();
  const list = document.getElementById("channelList");
  list.innerHTML = "";
  channels
    .filter(c => !activeGroup || c.group === activeGroup)
    .filter(c => !q || c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q))
    .forEach(c => {
      const li = document.createElement("li");
      if (c.premium) li.classList.add("premium");
      li.innerHTML = `<span class="ch-num">${String(c.number).padStart(2,"0")}</span><span class="ch-name">${c.name}</span><span class="ch-cat">${c.category}${c.tier ? " · " + c.tier : ""}</span>`;
      li.onclick = () => playChannel(c);
      if (current && current.number === c.number) li.classList.add("active");
      list.appendChild(li);
    });
}

function renderGroups() {
  const groupsEl = document.getElementById("groups");
  groupsEl.innerHTML = "";
  const groups = {};
  channels.forEach(c => { groups[c.group] = (groups[c.group] || 0) + 1; });
  const all = document.createElement("button");
  all.className = "group-btn";
  all.textContent = "ALL";
  all.onclick = () => { activeGroup = null; renderChannels(); };
  groupsEl.appendChild(all);
  Object.keys(groups).forEach(g => {
    const btn = document.createElement("button");
    btn.className = "group-btn";
    btn.textContent = g.toUpperCase();
    btn.onclick = () => { activeGroup = g; renderChannels(); };
    groupsEl.appendChild(btn);
  });
}

function liveProgram(c, now) {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  return { title: `LIVE: ${c.name}`, start, end: new Date(start.getTime() + 3600000) };
}

function programFor(c, now) {
  if (c.mode === "playlist" && c.items && c.items.length) {
    const s = calcPlaylist(c.items, c.startMs, c.startIndex, now);
    if (s) {
      const start = now - s.offset;
      return { title: s.item.title, start: new Date(start), end: new Date(start + s.item.duration * 1000) };
    }
  }
  if (c.mode === "archive") {
    if (c.items && c.items.length) {
      const s = calcPlaylist(c.items, c.startMs, c.startIndex, now);
      if (s) {
        const start = now - s.offset;
        return { title: s.item.title, start: new Date(start), end: new Date(start + s.item.duration * 1000) };
      }
    }
    return { title: "Loading guide…", start: new Date(now), end: new Date(now + 3600000) };
  }
  if (c.mode === "spelunkr") {
    const ch = spelunkrLineup && spelunkrLineup.channels.find(x => x.id === c.slug);
    if (ch) {
      const ver = latestVersion(ch);
      const manifest = ver && spelunkrManifests[ver.manifest];
      if (manifest) {
        const s = calcPlaylist(spelunkrItems(manifest), ver.epochMs, ver.startIndex, now);
        if (s) {
          const start = now - s.offset;
          return { title: s.item.title, start: new Date(start), end: new Date(start + s.item.duration * 1000) };
        }
      }
    }
    return { title: "Loading schedule…", start: new Date(now), end: new Date(now + 3600000) };
  }
  if (c.mode === "flv" || c.mode === "hls") return liveProgram(c, now);
  return { title: "External stream", start: new Date(now), end: new Date(now + 3600000) };
}

let epgTimer = null;
function scheduleEPGRender() {
  if (epgTimer) return;
  epgTimer = setTimeout(() => { epgTimer = null; renderEPG(); }, 250);
}

function renderEPG() {
  const grid = document.getElementById("epgGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const now = Date.now();
  const fmt = d => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  channels.forEach(c => {
    const p = programFor(c, now);
    const row = document.createElement("div");
    row.className = "epg-row" + (current && current.number === c.number ? " active" : "") + (c.premium ? " premium" : "");
    row.innerHTML = `<span class="epg-num">${String(c.number).padStart(2,"0")}</span><span class="epg-name">${c.name}</span><span class="epg-show">${p.title}</span><span class="epg-time">${fmt(p.start)}-${fmt(p.end)}</span>`;
    row.onclick = () => playChannel(c);
    grid.appendChild(row);
  });
}

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
    scheduleEPGRender();
  } catch (e) {}
}

async function preloadArchive() {
  const queue = standardChannels.filter(c => c.mode === "archive" && c.group !== "local");
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const c = queue.shift();
      try {
        await ensureArchiveItems(c, 600);
        scheduleEPGRender();
      } catch (e) {}
    }
  });
  await Promise.all(workers);
}

document.getElementById("search").addEventListener("input", renderChannels);
document.getElementById("epgToggle").addEventListener("click", () => {
  document.getElementById("epgPanel").classList.toggle("open");
});
document.getElementById("geoBtn").addEventListener("click", detectGeo);
document.getElementById("premiumBtn").addEventListener("click", () => {
  premiumOn = !premiumOn;
  document.getElementById("premiumBtn").textContent = `Premium: ${premiumOn ? "On" : "Off"}`;
  document.getElementById("premiumBtn").classList.toggle("on", premiumOn);
  rebuildChannels();
});

premiumChannels.forEach(c => (c.items || []).forEach(it => { it.title = cleanTitle(it.title); }));
rebuildChannels();
detectGeo();
preloadSpelunkr();
preloadArchive();
setInterval(renderEPG, 30000);

