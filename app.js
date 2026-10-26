const SPELUNKR_BASE = "https://jbuopkuluyfjwgsrigry.supabase.co/storage/v1/object/public/broadcast/";
const ARCHIVE_BASE = "https://archive.org/download/";
const BASE_START = Date.parse("2024-01-01T00:00:00Z");

const LOCAL_SECTIONS = [
  { key: "news", name: "Local News", desc: "Retro newscasts from the 90s and 2000s" },
  { key: "sports", name: "Local Sports", desc: "Local games, teams and sports broadcasts" },
  { key: "community", name: "Community Access", desc: "Public access and neighborhood voices" },
  { key: "government", name: "City Council", desc: "Local government, hearings and public meetings" },
  { key: "events", name: "Local Events", desc: "Parades, festivals, rallies and local events" },
  { key: "life", name: "Neighborhood", desc: "People, places and life around the city" },
  { key: "music", name: "Local Music", desc: "Local bands, concerts and music performances" },
  { key: "history", name: "Local History", desc: "Local history, museums and oral histories" },
  { key: "culture", name: "Local Culture", desc: "Local arts, theater, dance and culture" },
  { key: "voices", name: "Local Voices", desc: "Interviews, conversations and community voices" }
];

const LOCAL_NEWS_FALLBACK = [
  "wbbm-080194-10pm-r",
  "wmaq-080194-6pm",
  "wgn-news-at-noon-oct-31-2002-x-264",
  "kron-071692-11pm",
  "kgo-071692-11pm",
  "kpix-071692-10pm",
  "kvue-092791-6pm",
  "whdh-112092-530pm",
  "wcbs-112692-11pm",
  "ktvu-channel-2-news-10-pm-1999",
  "newswhdhboston19950508",
  "newscbs4wbztvboston20061119"
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

function clearMedia() {
  if (cleanupPlayer) {
    try { cleanupPlayer(); } catch (e) {}
    cleanupPlayer = null;
  }
  mount.querySelectorAll("video, iframe, .player-msg").forEach(el => el.remove());
  hideOverlay();
}

function clearPlayer() {
  clearMedia();
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

function mountVideo(src, startAt, onEnded, item) {
  hideOverlay();
  const v = makeVideo();
  let finished = false;
  let errTimer = null;
  const finish = () => {
    if (finished) return;
    finished = true;
    if (onEnded) onEnded();
  };
  v.addEventListener("loadedmetadata", () => {
    const dur = v.duration;
    if (isFinite(dur) && dur > 0 && item && Math.abs((item.duration || 0) - dur) > 1) {
      item.duration = Math.round(dur * 1000) / 1000;
    }
    if (startAt > 0 && isFinite(dur) && dur > 0) {
      if (startAt < dur - 0.5) {
        try { v.currentTime = startAt; } catch (e) {}
      } else {
        finish();
        return;
      }
    }
    v.play().catch(() => {});
  });
  v.addEventListener("ended", finish);
  v.addEventListener("error", () => {
    setOverlay("Video unavailable. Trying next…", true);
    errTimer = setTimeout(finish, 800);
  });
  v.src = src;
  cleanupPlayer = () => {
    clearTimeout(errTimer);
    v.pause();
    v.removeAttribute("src");
    v.load();
  };
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
  metaInflight[ident] = fetch("https://archive.org/metadata/" + encodeURIComponent(ident), { cache: "no-store", signal: AbortSignal.timeout(12000) })
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
  clearMedia();
  document.getElementById("nowPlaying").textContent = `NOW: ${item.title}`;
  renderEPG();
  mountVideo(url, offset || 0, () => { if (current === c) playPlaylist(c); }, item);
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

function playSpelunkrScheduled() {
  if (!activeSpelunkr) return;
  const { items, version } = activeSpelunkr;
  const sched = calcPlaylist(items, version.epochMs, version.startIndex, Date.now());
  if (sched) playSpelunkrItem(sched.index, sched.offset);
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
  clearMedia();
  document.getElementById("nowPlaying").textContent = `NOW: ${item.title}`;
  renderEPG();
  mountVideo(url, offset || 0, playSpelunkrScheduled, item);
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

const LOCAL_ALIASES = {
  "new york": /\bnew york city\b|\bnyc\b|\bwnyw\b|\bwcbs\b|\bwnbc\b|\bwabc\b|\bwpix\b/i,
  "washington": /\bwashington,?\s*d\.?c\.?\b|\bwashington dc\b|\bwusa\b|\bwjla\b|\bwrc\b|\bwttg\b/i
};
const LOCAL_BAD = /youtube|funny.?or.?die|promo|clip|start|partial|commercial|bumper|teaser|segment|conference|meeting|forum|lecture|awards|concert|game|sports|footage|fragment|ending|signoff|anthem|cnn|foxnews|msnbc|hln|cspan|world news|nightly news|good morning america|wgn america|infomercial|trailer|highlights|press conference|interview/i;
const LOCAL_NEWS_OK = /\bnews|newscast|news at|eyewitness news|newsbreak|news break\b/i;
const LOCAL_NOT_NEWS = /\b(newscast|news at|eyewitness|world news|nightly news|good morning|today show|newsbreak|news break)\b/i;
const LOCAL_OTHER_PLACE = /\b(ithaca|lewisville|kalamazoo|iowa city|philippines|boston|new york|los angeles|san francisco|seattle|houston|dallas|atlanta|miami|denver|phoenix|philadelphia|detroit|cleveland|pittsburgh|st\.? louis|minneapolis|milwaukee|indianapolis|columbus|austin|portland|sacramento|orlando|tampa|baltimore|washington|montreal|toronto|london|paris|tokyo)\b/i;
const LOCAL_MARKERS = /\b(vva|vietnam veterans|pilsen|cantv|community council|neighborhood|poetry center|free street|hyde park|access living|chicago|illinois|wgn|wbbm|wmaq|wls|wttw|wciu|wgn-tv|wbbm-tv|wmaq-tv)\b/i;

const LOCAL_RULES = {
  sports: /\b(sports?|football|basketball|baseball|hockey|boxing|bulls|cubs|white sox|blackhawks|bears|championship|nba|nfl|mlb|nhl|game\s+\d|vs\.?)\b/i,
  music: /\b(music|concert|band|live at|performance|song|jazz|blues|hip[- ]?hop|rock|choir|orchestra|musical)\b/i,
  history: /\b(history|historical|heritage|oral history|museum|archive|stories|remember|veterans)\b/i,
  government: /\b(government|council|committee|board|town hall|hearing|tif|public meeting|alderman|legislative|policy|civic)\b/i,
  events: /\b(festival|parade|fair|celebration|pride|memorial|veterans day|event|rally|march)\b/i,
  culture: /\b(art|arts|culture|theater|theatre|dance|poetry|literature|gallery|film|photography|playwright)\b/i,
  voices: /\b(interview|talk|voices|conversation|forum|discussion|oral history|stories)\b/i,
  community: /\b(community|public access|cantv|access|neighborhood|pilsen|block club|local)\b/i,
  life: /\b(life|people|neighborhood|food|family|health|school|youth|children|housing|work)\b/i
};

function escapeRegExp(v) {
  return String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function docHay(d) {
  return `${d.title || ""} ${d.subject || ""} ${d.description || ""} ${d.identifier || ""}`.toLowerCase();
}

function isFullNewscast(d) {
  const hay = docHay(d);
  return LOCAL_NEWS_OK.test(hay) && !LOCAL_BAD.test(hay);
}

function isLocalDoc(d, city) {
  if (!city) return false;
  const cityRe = new RegExp(`\\b${escapeRegExp(city)}\\b`, "i");
  const hay = docHay(d);
  if (!cityRe.test(hay)) return false;
  const strong = `${d.title || ""} ${d.subject || ""} ${d.identifier || ""}`.toLowerCase();
  if (cityRe.test(strong)) return true;
  if (/archive_cantv|cantv/.test(strong)) return true;
  if (LOCAL_MARKERS.test(strong)) return true;
  return false;
}

function isLocalNewscast(d, city) {
  if (!city || !isFullNewscast(d) || !isLocalDoc(d, city)) return false;
  const alias = LOCAL_ALIASES[city.toLowerCase()];
  return !alias || alias.test(docHay(d));
}

function localName(i, city, local) {
  const sec = LOCAL_SECTIONS[i];
  if (local && city) return `${city} ${sec.name}`;
  return i === 0 ? "Retro News" : `Retro News ${i + 1}`;
}

function localScore(d, rule) {
  const t = String(d.title || "").toLowerCase();
  const sub = String(d.subject || "").toLowerCase();
  const desc = String(d.description || "").toLowerCase();
  return (rule.test(t) ? 3 : 0) + (rule.test(sub) ? 2 : 0) + (rule.test(desc) ? 1 : 0);
}

function assignLocalSections(docs, city) {
  const used = new Set();
  const byKey = {};
  const news = docs
    .filter(d => isLocalNewscast(d, city))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
    .slice(0, 4);
  for (const d of news) used.add(d.identifier);
  byKey.news = news;

  const order = ["sports", "music", "history", "government", "events", "culture", "voices", "community", "life"];
  for (const key of order) {
    const rule = LOCAL_RULES[key];
    const picks = docs
      .filter(d => !used.has(d.identifier) && !LOCAL_NOT_NEWS.test(docHay(d)) && rule.test(docHay(d)))
      .sort((a, b) => localScore(b, rule) - localScore(a, rule) || String(a.title || "").localeCompare(String(b.title || "")))
      .slice(0, 4);
    for (const d of picks) used.add(d.identifier);
    byKey[key] = picks;
  }

  for (const key of ["community", "life"]) {
    if (byKey[key].length >= 2) continue;
    for (const d of docs) {
      if (byKey[key].length >= 4) break;
      if (used.has(d.identifier) || isLocalNewscast(d, city) || LOCAL_NOT_NEWS.test(docHay(d))) continue;
      byKey[key].push(d);
      used.add(d.identifier);
    }
  }

  for (const key of order) {
    if (byKey[key].length) continue;
    for (const d of docs) {
      if (used.has(d.identifier) || isLocalNewscast(d, city) || LOCAL_NOT_NEWS.test(docHay(d))) continue;
      byKey[key] = [d];
      used.add(d.identifier);
      break;
    }
  }

  const spare = docs.filter(d => !used.has(d.identifier)).slice(0, 40);
  return { byKey, spare };
}

function applyLocalDocs(docs, city, local) {
  const unique = [];
  const seen = new Set();
  for (const d of docs || []) {
    if (!d || !d.identifier || seen.has(d.identifier)) continue;
    seen.add(d.identifier);
    unique.push(d);
  }
  if (!unique.length) unique.push(...LOCAL_NEWS_FALLBACK.map(id => ({ identifier: id, title: id.replace(/[-_]/g, " ") })));
  for (let i = 0; i < LOCAL_SECTIONS.length; i++) {
    const d = unique[i % unique.length];
    const sec = LOCAL_SECTIONS[i];
    Object.assign(standardChannels[i], {
      name: localName(i, city, local),
      description: local ? `${sec.desc}${city ? " — " + city : ""}` : "Retro newscasts from the 90s and 2000s",
      mode: "archive",
      ident: d.identifier,
      items: null,
      startMs: null,
      startIndex: 0,
      src: `https://archive.org/details/${d.identifier}`,
      category: local ? "Local" : "News",
      group: local ? "local" : "news",
      local
    });
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

async function buildLocalPlaylists(byKey, city, local, token, spareDocs) {
  const usedItemIds = new Set();
  const usedTitles = new Set();
  const itemsByKey = {};
  const flat = [];
  for (const [key, docs] of Object.entries(byKey)) {
    for (const d of docs || []) flat.push({ key, d });
  }
  const fetched = await mapLimit(flat, 6, async x => {
    try { return { ...x, meta: await loadMeta(x.d.identifier) }; } catch (e) { return { ...x, meta: null }; }
  });
  const selected = {};
  for (const x of fetched) {
    if (!selected[x.key]) selected[x.key] = [];
    selected[x.key].push([x.d, x.meta]);
  }

  for (const [key, metas] of Object.entries(selected)) {
    const items = [];
    for (const [d, meta] of metas) {
      if (!meta) continue;
      const cands = itemsFromMeta(d.identifier, meta, 300);
      if (!cands.length) continue;
      cands.sort((a, b) => b.duration - a.duration);
      const item = cands.find(x => !usedItemIds.has(x.id) && !usedTitles.has(String(x.title).toLowerCase().trim()));
      if (!item) continue;
      usedItemIds.add(item.id);
      usedTitles.add(String(item.title).toLowerCase().trim());
      items.push(item);
    }
    itemsByKey[key] = items;
  }

  for (const sec of LOCAL_SECTIONS) {
    if ((itemsByKey[sec.key] || []).length) continue;
    for (const d of spareDocs || []) {
      if (!d || !d.identifier) continue;
      try {
        const meta = await loadMeta(d.identifier);
        const cands = itemsFromMeta(d.identifier, meta, 300);
        if (!cands.length) continue;
        cands.sort((a, b) => b.duration - a.duration);
        const item = cands.find(x => !usedItemIds.has(x.id) && !usedTitles.has(String(x.title).toLowerCase().trim()));
        if (!item) continue;
        usedItemIds.add(item.id);
        usedTitles.add(String(item.title).toLowerCase().trim());
        itemsByKey[sec.key] = [item];
        break;
      } catch (e) {}
    }
  }

  let any = false;
  for (let i = 0; i < LOCAL_SECTIONS.length; i++) {
    const sec = LOCAL_SECTIONS[i];
    const items = itemsByKey[sec.key] || [];
    const c = standardChannels[i];
    c.name = localName(i, city, local);
    c.description = `${sec.desc}${local && city ? " — " + city : ""}`;
    c.category = local ? "Local" : "News";
    c.group = local ? "local" : "news";
    c.local = local;
    if (items.length) {
      any = true;
      c.mode = "playlist";
      c.items = items;
      c.startMs = BASE_START + i * 7 * 3600000;
      c.startIndex = (i * 3) % items.length;
      c.ident = items[0].id;
      c.src = `https://archive.org/details/${items[0].id}`;
    } else {
      c.mode = "archive";
      c.items = null;
      c.startMs = null;
      c.startIndex = 0;
      const d = (spareDocs || [])[i];
      if (d) {
        c.ident = d.identifier;
        c.src = `https://archive.org/details/${d.identifier}`;
      }
    }
  }
  if (token === playToken) {
    renderEPG();
    if (current && current.local && current.mode === "playlist") playPlaylist(current);
  }
  return any;
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
  const search = async (q, rows = 60) => {
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=subject&fl%5B%5D=description&fl%5B%5D=date&rows=${rows}&output=json`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
      const j = await r.json();
      return (j.response && j.response.docs || []).filter(d => d.identifier);
    } catch (e) { return []; }
  };
  const fetchLocalDocs = async localCity => {
    const cq = `(title:("${localCity}") OR subject:("${localCity}") OR description:("${localCity}") OR identifier:("${localCity}"))`;
    const dateq = "date:[1990-01-01 TO 2009-12-31]";
    const queries = [
      [`collection:vhsnews AND ${dateq} AND mediatype:movies AND ${cq} AND (title:(news) OR subject:(newscast))`, 60],
      [`(collection:vhsnews OR collection:community_media OR collection:opensource_movies OR collection:sports) AND ${dateq} AND mediatype:movies AND ${cq}`, 400]
    ];
    if (localCity.toLowerCase() === "chicago") {
      queries.push([`collection:community_media AND ${dateq} AND mediatype:movies AND identifier:archive_cantv*`, 200]);
    }
    const batches = await Promise.all(queries.map(([q, rows]) => search(q, rows)));
    const seen = new Set();
    const docs = [];
    for (const d of batches.flat()) {
      if (!d || !d.identifier || seen.has(d.identifier) || !isLocalDoc(d, localCity)) continue;
      seen.add(d.identifier);
      docs.push(d);
    }
    return docs;
  };

  const localCity = clean(city);
  let localDocs = [];
  if (localCity) localDocs = await fetchLocalDocs(localCity);
  const local = !!(localCity && localDocs.length >= 4);

  if (local) {
    const { byKey, spare } = assignLocalSections(localDocs, localCity);
    renderGroups();
    renderChannels();
    renderEPG();
    const ok = await buildLocalPlaylists(byKey, localCity, true, playToken, spare);
    if (!ok) applyLocalDocs(localDocs, localCity, true);
  } else {
    let docs = [];
    const q = `collection:vhsnews AND date:[1990-01-01 TO 2009-12-31] AND mediatype:movies AND (title:(news) OR subject:(newscast))`;
    docs = (await search(q, 60)).filter(isFullNewscast);
    if (!docs.length) docs = LOCAL_NEWS_FALLBACK.map(id => ({ identifier: id, title: id.replace(/[-_]/g, " ") }));
    applyLocalDocs(docs, localCity, false);
  }

  renderGroups();
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
      const start = now - s.offset * 1000;
      return { title: s.item.title, start: new Date(start), end: new Date(start + s.item.duration * 1000) };
    }
  }
  if (c.mode === "archive") {
    if (c.items && c.items.length) {
      const s = calcPlaylist(c.items, c.startMs, c.startIndex, now);
      if (s) {
        const start = now - s.offset * 1000;
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
          const start = now - s.offset * 1000;
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

