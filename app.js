const SPELUNKR_BASE = "https://jbuopkuluyfjwgsrigry.supabase.co/storage/v1/object/public/broadcast/";
const ARCHIVE_BASE = "https://archive.org/download/";

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
const LOCAL_POOLS = { US: LOCAL_CONTENT, GB: LOCAL_CONTENT, CA: LOCAL_CONTENT, AU: LOCAL_CONTENT };

let channels = window.CHANNELS.slice();
let current = null;
let activeGroup = null;
let cleanupPlayer = null;
let spelunkrLineup = null;
let spelunkrManifests = {};
let activeSpelunkr = null;
let archiveMeta = {};

const mount = document.getElementById("playerMount");
const overlay = document.getElementById("playerOverlay");

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
  box.innerHTML = `<p>This source blocks embedded playback.</p><a href="${c.src}" target="_blank" rel="noopener">Open ${c.name} in a new tab</a>`;
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

function scheduleFor(manifest, version, now) {
  const items = manifest.items;
  const total = items.reduce((s, i) => s + (i.duration || 0), 0);
  if (!items.length || !total) return null;
  let phase = ((now - version.epochMs) % total + total) % total;
  let idx = ((version.startIndex || 0) % items.length + items.length) % items.length;
  while (phase >= items[idx].duration) {
    phase -= items[idx].duration;
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
      mountVideo(url, offset || 0, () => playSpelunkrItem(next, 0));
      return;
    }
    idx = (idx + 1) % items.length;
    tries++;
  }
  setOverlay("No playable item in this schedule.", true);
}

async function playArchive(c) {
  setOverlay("Loading from archive.org…");
  let meta = archiveMeta[c.ident];
  if (!meta) {
    const r = await fetch("https://archive.org/metadata/" + encodeURIComponent(c.ident), { cache: "no-store" });
    if (!r.ok) throw new Error("metadata " + r.status);
    meta = await r.json();
    archiveMeta[c.ident] = meta;
  }
  const files = (meta.files || []).filter(f => /\.mp4$/i.test(f.name || ""));
  if (!files.length) throw new Error("no video file");
  const preferred = files.filter(f => /h\.264/i.test(f.format || "") || /\.ia\.mp4$/i.test(f.name));
  const pool = preferred.length ? preferred : files;
  const pick = pool[Math.floor(Date.now() / 3600000) % pool.length];
  const url = "https://archive.org/download/" + encodeURIComponent(c.ident) + "/" + encodeURIComponent(pick.name);
  document.getElementById("nowPlaying").textContent = `NOW: ${pick.title || pick.name.replace(/\.mp4$/i, "")}`;
  mountVideo(url, 0, () => playArchive(c));
}

async function playChannel(c) {
  current = c;
  clearPlayer();
  document.getElementById("channelTitle").textContent = `${String(c.number).padStart(2,"0")} ${c.name}`;
  document.getElementById("channelDesc").textContent = c.description;
  document.getElementById("openTab").href = c.src;
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
    } else if (c.mode === "archive") {
      await playArchive(c);
    } else if (c.mode === "iframe") {
      mountIframe(c.src);
    } else {
      mountExternal(c);
    }
  } catch (e) {
    setOverlay("Could not load this channel. Try another.", true);
  }
}

function applyLocalPool(pool) {
  for (let i = 0; i < 10; i++) {
    const [name, desc, ident] = pool[i];
    channels[i] = Object.assign({}, channels[i], {
      name, description: desc, mode: "archive", ident,
      src: `https://archive.org/details/${ident}`,
      category: "Local", group: "local"
    });
  }
}

function applyLocalResults(docs, city, region) {
  const label = city || region || "Local";
  for (let i = 0; i < 10; i++) {
    let name, desc, ident;
    if (i < docs.length) {
      ident = docs[i].identifier;
      name = (docs[i].title || "Local Programming").replace(/\s+/g, " ").slice(0, 42);
      desc = `Local programming for ${label}`;
    } else {
      const [n, d, id] = LOCAL_CONTENT[i % LOCAL_CONTENT.length];
      name = n; desc = d; ident = id;
    }
    channels[i] = Object.assign({}, channels[i], {
      name, description: desc, mode: "archive", ident,
      src: `https://archive.org/details/${ident}`,
      category: "Local", group: "local"
    });
  }
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
  let docs = [];
  const clean = v => String(v || "").replace(/["\\]/g, "").trim();
  if (clean(city) || clean(region)) {
    const q = `(title:("${clean(city)}") OR title:("${clean(region)}")) AND collection:community_media AND mediatype:movies`;
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&rows=20&output=json`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(7000) });
      const j = await r.json();
      docs = (j.response && j.response.docs || []).filter(d => d.identifier);
    } catch (e) {}
  }
  if (docs.length >= 3) applyLocalResults(docs, city, region);
  else applyLocalPool(LOCAL_POOLS[code] || LOCAL_POOLS.US);
  document.getElementById("geoBtn").textContent = `Location: ${city ? city + ", " : ""}${code}`;
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
      li.innerHTML = `<span class="ch-num">${String(c.number).padStart(2,"0")}</span><span class="ch-name">${c.name}</span><span class="ch-cat">${c.category}</span>`;
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

function programFor(c, now) {
  if (c.mode === "spelunkr") {
    const ch = spelunkrLineup && spelunkrLineup.channels.find(x => x.id === c.slug);
    if (ch) {
      const ver = latestVersion(ch);
      const manifest = ver && spelunkrManifests[ver.manifest];
      if (manifest) {
        const sched = scheduleFor(manifest, ver, now);
        if (sched) {
          const item = sched.item;
          const start = now - sched.offset;
          return { title: item.title || "Spelunkr", start: new Date(start), end: new Date(start + item.duration * 1000) };
        }
      }
    }
  }
  const titles = {
    Local: ["Morning News","Midday Update","Evening News","Late Edition"],
    "Vaughn Live": ["Live Stream","Community Chat","Viewer Requests"],
    Retro: ["Classic Block","Retro Hour","Throwback"],
    Spelunkr: ["Loading schedule…"],
    "Archive TV": ["Classic Episode","Archive Hour","Retro Replay"]
  };
  const list = titles[c.category] || ["Program"];
  const nowD = new Date(now);
  const start = new Date(nowD);
  start.setMinutes(0, 0, 0);
  const hour = nowD.getHours();
  return { title: list[hour % list.length], start, end: new Date(start.getTime() + 3600000) };
}

function renderEPG() {
  const grid = document.getElementById("epgGrid");
  grid.innerHTML = "";
  const now = Date.now();
  channels.forEach(c => {
    const p = programFor(c, now);
    const row = document.createElement("div");
    row.className = "epg-row" + (current && current.number === c.number ? " active" : "");
    const fmt = d => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
    renderEPG();
  } catch (e) {}
}

document.getElementById("search").addEventListener("input", renderChannels);
document.getElementById("epgToggle").addEventListener("click", () => {
  document.getElementById("epgPanel").classList.toggle("open");
});
document.getElementById("geoBtn").addEventListener("click", detectGeo);

renderGroups();
renderChannels();
renderEPG();
detectGeo();
preloadSpelunkr();
setInterval(renderEPG, 30000);
