const SPELUNKR_BASE = "https://jbuopkuluyfjwgsrigry.supabase.co/storage/v1/object/public/broadcast/";
const ARCHIVE_BASE = "https://archive.org/download/";
const BASE_START = Date.parse("2024-01-01T00:00:00Z");

const THEME_KEYS = { era: "tvgrid-era", fx: "tvgrid-fx", tube: "tvgrid-tube" };
function readPreference(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch (e) { return fallback; }
}
function writePreference(key, value) {
  try { localStorage.setItem(key, value); } catch (e) {}
}
let tvEra = readPreference(THEME_KEYS.era, "90s") === "2000s" ? "2000s" : "90s";
let crtOn = readPreference(THEME_KEYS.fx, "on") !== "off";
let tubeOn = readPreference(THEME_KEYS.tube, "on") !== "off";

function updateGuideClock() {
  const el = document.getElementById("guideClock");
  const now = new Date();
  if (el) {
    const time = now.toLocaleTimeString([], { hour: tvEra === "90s" ? "numeric" : "2-digit", minute: "2-digit" });
    el.textContent = tvEra === "90s"
      ? `${now.toLocaleDateString([], { weekday: "short" }).toUpperCase()} ${time}`
      : `${now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · ${time}`;
  }
  const nowTime = document.getElementById("guideNowTime");
  if (nowTime) nowTime.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function applyTheme({ render = true } = {}) {
  document.body.dataset.era = tvEra;
  document.body.classList.toggle("fx-on", crtOn);
  document.body.classList.toggle("tube-on", tubeOn);
  const eraBtn = document.getElementById("eraBtn");
  const fxBtn = document.getElementById("fxBtn");
  const tubeBtn = document.getElementById("tubeBtn");
  if (eraBtn) eraBtn.textContent = `Era: ${tvEra}`;
  if (fxBtn) {
    fxBtn.textContent = `CRT: ${crtOn ? "On" : "Off"}`;
    fxBtn.classList.toggle("on", crtOn);
    fxBtn.setAttribute("aria-pressed", String(crtOn));
  }
  if (tubeBtn) {
    tubeBtn.textContent = `Tube: ${tubeOn ? "On" : "Off"}`;
    tubeBtn.classList.toggle("on", tubeOn);
    tubeBtn.setAttribute("aria-pressed", String(tubeOn));
  }
  const kicker = document.getElementById("guideKicker");
  const title = document.getElementById("guideTitle");
  if (kicker) kicker.textContent = tvEra === "90s" ? "TV LISTINGS" : "PROGRAM GUIDE";
  if (title) title.textContent = tvEra === "90s" ? "TONIGHT'S LINEUP" : "Live Channel Guide";
  updateGuideClock();
  if (render) renderEPG();
}

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

const LOCAL_NEWS_ITEMS = {
  "wgn-news-at-noon-oct-31-2002-x-264": { file: "WGN News at Noon Oct 31 2002_x264.mp4", duration: 2562.78, title: "WGN News At Noon Oct 31 2002", year: "2002" },
  "wbbm-080194-10pm-r": { file: "wbbm-080194-10pm-r#.mp4", duration: 1973.16, title: "WBBM August 1, 1994 10pm", year: "1994" },
  "wmaq-080194-6pm": { file: "wmaq-080194-6pm#.mp4", duration: 1843.91, title: "WMAQ August 1, 1994 6pm", year: "1994" }
};

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
  "washington": /\bwashington,?\s*d\.?c\.?\b|\bwashington dc\b|\bwusa\b|\bwjla\b|\bwrc\b|\bwttg\b/i,
  "phoenix": /\bkpnx\b|\bktvk\b|\bksaz\b|\bknxv\b|\bkpho\b|\bkaet\b|\bkasr\b|\b3tv\b|\b12news\b|\babc15\b|\bfox10\b/i
};
const LOCAL_METRO = {
  "phoenix": /\b(phoenix|tempe|mesa|scottsdale|glendale|peoria|chandler|gilbert|paradise valley|ahwatukee|asu)\b/i
};
const LOCAL_REGION = {
  "phoenix": "Arizona",
  "chicago": "Illinois"
};
const LOCAL_BAD = /youtube|funny.?or.?die|newsreel|newspaper|newsletter|newsstand|promo|clip|start|partial|commercial|bumper|teaser|segment|conference|meeting|forum|lecture|awards|concert|game|sports|footage|fragment|ending|signoff|anthem|cnn|foxnews|msnbc|hln|cspan|world news|nightly news|good morning america|wgn america|infomercial|trailer|highlights|press conference|interview/i;
const LOCAL_NEWS_OK = /\bnews|newscast|news at|eyewitness news|newsbreak|news break\b/i;
const LOCAL_NOT_NEWS = /\b(newscast|news at|eyewitness|world news|nightly news|good morning|today show|newsbreak|news break)\b/i;
const LOCAL_JUNK = /\b(commercials?|commericals?|infomercial|promo|trailer|clips?|teaser|bumper|highlights?|footage|fragment|signoff|anthem|compilation)\b/i;
const LOCAL_SPORTS = /\b(nba|nfl|mlb|nhl|bulls|cubs|white sox|blackhawks|bears|finals|championship|game\s+\d|vs\.?)\b/i;
const LOCAL_OTHER_PLACE = /\b(ithaca|lewisville|kalamazoo|iowa city|philippines|boston|new york|los angeles|san francisco|seattle|houston|dallas|atlanta|miami|denver|phoenix|philadelphia|detroit|cleveland|pittsburgh|st\.? louis|minneapolis|milwaukee|indianapolis|columbus|austin|portland|sacramento|orlando|tampa|baltimore|washington|montreal|toronto|london|paris|tokyo)\b/i;
const LOCAL_MARKERS = /\b(vva|vietnam veterans|pilsen|cantv|community council|neighborhood|poetry center|free street|hyde park|access living|union|workers|government access|community media|public access|peg|arizona|maricopa|tempe|mesa|scottsdale|glendale|peoria|tucson|asu)\b/i;

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

function escapeHtml(v) {
  return String(v).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function docHay(d) {
  return `${d.title || ""} ${d.subject || ""} ${d.description || ""} ${d.identifier || ""}`.toLowerCase();
}

function isFullNewscast(d) {
  const hay = docHay(d);
  return LOCAL_NEWS_OK.test(hay) && !LOCAL_BAD.test(hay);
}

function isLocalDoc(d, city, region) {
  if (!city) return false;
  const cityRe = new RegExp(`\\b${escapeRegExp(city)}\\b`, "i");
  const title = String(d.title || "").toLowerCase();
  const subject = String(d.subject || "").toLowerCase();
  const identifier = String(d.identifier || "").toLowerCase();
  const desc = String(d.description || "").toLowerCase();
  const strong = `${title} ${subject} ${identifier}`;
  const hay = `${strong} ${desc}`;
  const regionRe = region && region.length > 2 ? new RegExp(`\\b${escapeRegExp(region)}\\b`, "i") : null;
  const regionStrong = !!(regionRe && regionRe.test(strong));
  const metroRe = LOCAL_METRO[city.toLowerCase()];
  const metroHit = !!(metroRe && metroRe.test(hay));
  const cityHit = cityRe.test(hay);
  if (!cityHit && !metroHit && !regionStrong) return false;
  if (/archive_cantv|cantv/.test(strong)) return true;
  const cityStrong = cityRe.test(strong);
  const alias = LOCAL_ALIASES[city.toLowerCase()];
  const aliasStrong = !!(alias && alias.test(strong));
  if (city.toLowerCase() === "chicago" && cityStrong) return true;
  if (aliasStrong) return true;
  const markerStrong = LOCAL_MARKERS.test(strong);
  if ((cityHit || metroHit) && markerStrong) return true;
  if (city.toLowerCase() !== "chicago" && regionStrong && markerStrong && !metroRe) return true;
  return markerStrong && cityRe.test(desc);
}

function isLocalNewscast(d, city, region) {
  if (!city || !isFullNewscast(d) || !isLocalDoc(d, city, region)) return false;
  const strong = `${d.title || ""} ${d.subject || ""} ${d.identifier || ""}`;
  const other = strong.replace(new RegExp(`\\b${escapeRegExp(city)}\\b`, "gi"), "");
  if (LOCAL_OTHER_PLACE.test(other)) return false;
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

function assignLocalSections(docs, city, region) {
  const used = new Set();
  const byKey = {};
  const news = docs
    .filter(d => isLocalNewscast(d, city, region))
    .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")))
    .slice(0, 4);
  for (const d of news) used.add(d.identifier);
  byKey.news = news;
  if (city.toLowerCase() === "chicago") {
    for (const id of ["wgn-news-at-noon-oct-31-2002-x-264", "wbbm-080194-10pm-r", "wmaq-080194-6pm"]) {
      if (byKey.news.some(d => d.identifier === id)) continue;
      byKey.news.push({ identifier: id, title: id, description: "Chicago" });
      used.add(id);
    }
    byKey.news = byKey.news.slice(0, 4);
  }

  const order = ["sports", "music", "history", "government", "events", "culture", "voices", "community", "life"];
  for (const key of order) {
    const rule = LOCAL_RULES[key];
    const picks = docs
      .filter(d => {
        if (used.has(d.identifier)) return false;
        const hay = docHay(d);
        if (isLocalNewscast(d, city, region) || LOCAL_NOT_NEWS.test(hay) || LOCAL_JUNK.test(hay)) return false;
        if (key !== "sports" && LOCAL_SPORTS.test(hay)) return false;
        if (!rule.test(`${d.title || ""} ${d.subject || ""}`)) return false;
        return rule.test(hay);
      })
      .sort((a, b) => localScore(b, rule) - localScore(a, rule) || String(a.title || "").localeCompare(String(b.title || "")))
      .slice(0, 4);
    for (const d of picks) used.add(d.identifier);
    byKey[key] = picks;
  }

  const spare = docs.filter(d => !used.has(d.identifier) && !LOCAL_JUNK.test(docHay(d))).slice(0, 40);
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
  for (const x of fetched) {
    if (x.meta || x.key !== "news") continue;
    try { x.meta = await loadMeta(x.d.identifier); } catch (e) {}
  }
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

  if (city.toLowerCase() === "chicago") {
    itemsByKey.news = itemsByKey.news || [];
    for (const [id, f] of Object.entries(LOCAL_NEWS_ITEMS)) {
      if (itemsByKey.news.some(i => i.id === id)) continue;
      const titleKey = f.title.toLowerCase().trim();
      if (usedTitles.has(titleKey)) continue;
      const item = { id, file: f.file, duration: f.duration, title: f.title, year: f.year };
      usedItemIds.add(id);
      usedTitles.add(titleKey);
      itemsByKey.news.push(item);
    }
  }

  for (const sec of LOCAL_SECTIONS) {
    if (sec.key === "news") continue;
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
  let vaultCount = 0;
  for (let i = 0; i < LOCAL_SECTIONS.length; i++) {
    const sec = LOCAL_SECTIONS[i];
    const items = itemsByKey[sec.key] || [];
    const c = standardChannels[i];
    const isVault = !(byKey[sec.key] || []).length || !items.length;
    if (isVault) {
      vaultCount++;
      c.name = local && city ? `${city} Local Vault${vaultCount > 1 ? " " + vaultCount : ""}` : `Local Vault${vaultCount > 1 ? " " + vaultCount : ""}`;
      c.description = `A rotating mix of local archive programming${local && city ? " — " + city : ""}`;
    } else {
      c.name = localName(i, city, local);
      c.description = `${sec.desc}${local && city ? " — " + city : ""}`;
    }
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
    region = j.region || LOCAL_REGION[String(city).toLowerCase()] || "";
  } catch (e) {}
  document.getElementById("geoBtn").textContent = `Location: ${city ? city + ", " : ""}${code}`;
  const clean = v => String(v || "").replace(/["\\]/g, "").trim();
  const search = async (q, rows = 60) => {
    const u = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=subject&fl%5B%5D=description&fl%5B%5D=date&rows=${rows}&output=json`;
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
      const j = await r.json();
      return (j.response && j.response.docs || []).filter(d => d.identifier);
    } catch (e) { return []; }
  };
  const fetchLocalDocs = async localCity => {
    const cq = `(title:("${localCity}") OR subject:("${localCity}") OR description:("${localCity}") OR identifier:("${localCity}"))`;
    const dateq = "date:[1990-01-01 TO 2009-12-31]";
    const queries = [
      [`collection:vhsnews AND ${dateq} AND mediatype:movies AND ${cq} AND (title:(news) OR subject:(newscast))`, 60],
      [`(collection:vhsnews OR collection:community_media OR collection:opensource_movies OR collection:sports) AND ${dateq} AND mediatype:movies AND ${cq}`, 400],
      [`(collection:community_media OR collection:opensource_movies) AND ${dateq} AND mediatype:movies AND ${cq} AND (title:(music) OR subject:(music) OR title:(concert) OR title:(live) OR title:(jazz) OR title:(blues) OR title:(band))`, 100],
      [`(collection:community_media OR collection:opensource_movies) AND ${dateq} AND mediatype:movies AND ${cq} AND (title:(history) OR subject:(history) OR title:(museum) OR title:(historical))`, 100]
    ];
    if (localCity.toLowerCase() === "chicago") {
      queries.push([`collection:community_media AND ${dateq} AND mediatype:movies AND identifier:archive_cantv*`, 200]);
    } else if (region && region.length > 2) {
      const rq = `(title:("${region}") OR subject:("${region}") OR description:("${region}") OR identifier:("${region}"))`;
      queries.push([`(collection:vhsnews OR collection:community_media OR collection:sports) AND ${dateq} AND mediatype:movies AND ${rq}`, 400]);
    }
    const batches = await Promise.all(queries.map(([q, rows]) => search(q, rows)));
    const seen = new Set();
    const docs = [];
    for (const d of batches.flat()) {
      if (!d || !d.identifier || seen.has(d.identifier) || !isLocalDoc(d, localCity, region)) continue;
      seen.add(d.identifier);
      docs.push(d);
    }
    return docs;
  };

  const localCity = clean(city);
  let localDocs = [];
  if (localCity) localDocs = await fetchLocalDocs(localCity);
  const local = !!(localCity && localDocs.length >= 2);

  if (local) {
    const { byKey, spare } = assignLocalSections(localDocs, localCity, region);
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

function walkGuidePlaylist(items, startMs, startIndex, guideStart, guideEnd) {
  if (!items || !items.length) return [];
  const sched = calcPlaylist(items, startMs, startIndex, guideStart);
  if (!sched) return [];
  const out = [];
  let itemStart = guideStart - sched.offset * 1000;
  let idx = sched.index;
  let guard = 0;
  while (itemStart < guideEnd && guard++ < 60) {
    const item = items[idx % items.length];
    const dur = (item.duration || 0) * 1000;
    if (!dur) break;
    out.push({ title: item.title, start: itemStart, end: itemStart + dur });
    itemStart += dur;
    idx = (idx + 1) % items.length;
  }
  return out;
}

function guideSchedule(c, guideStart, guideEnd) {
  if (c.mode === "playlist" && c.items && c.items.length) {
    return walkGuidePlaylist(c.items, c.startMs, c.startIndex, guideStart, guideEnd);
  }
  if (c.mode === "archive" && c.items && c.items.length) {
    return walkGuidePlaylist(c.items, c.startMs, c.startIndex, guideStart, guideEnd);
  }
  if (c.mode === "spelunkr") {
    const ch = spelunkrLineup && spelunkrLineup.channels.find(x => x.id === c.slug);
    const ver = ch && latestVersion(ch);
    const manifest = ver && spelunkrManifests[ver.manifest];
    if (manifest) return walkGuidePlaylist(spelunkrItems(manifest), ver.epochMs, ver.startIndex, guideStart, guideEnd);
  }
  if (c.mode === "flv" || c.mode === "hls") return [{ title: `LIVE: ${c.name}`, start: guideStart, end: guideEnd }];
  if (c.mode === "archive") return [{ title: "Loading guide…", start: guideStart, end: guideEnd }];
  if (c.mode === "spelunkr") return [{ title: "Loading schedule…", start: guideStart, end: guideEnd }];
  return [{ title: c.name, start: guideStart, end: guideEnd }];
}

function guideStationName(c) {
  if (!c.local) return c.name;
  return c.name.replace(/^.+?\s+(?=(Local|Community|City|Neighborhood|Events)\b)/, "");
}

let epgTimer = null;
function scheduleEPGRender() {
  if (epgTimer) return;
  epgTimer = setTimeout(() => { epgTimer = null; renderEPG(); }, 250);
}

function renderEPG() {
  const grid = document.getElementById("epgGrid");
  if (!grid) return;
  const now = Date.now();
  const step = 30 * 60 * 1000;
  const slots = 4;
  const guideStart = Math.floor(now / step) * step;
  const guideEnd = guideStart + slots * step;
  const fmt = d => d.toLocaleTimeString([], tvEra === "90s" ? { hour: "numeric", minute: "2-digit" } : { hour: "2-digit", minute: "2-digit" });
  const sub = document.getElementById("guideNowPlaying");
  if (sub) sub.textContent = current ? `${current.name} · ${programFor(current, now).title}` : "Select a channel to see what's on";
  updateGuideClock();
  const timebar = document.getElementById("guideTimebar");
  if (timebar) {
    timebar.innerHTML = `<div class="guide-time-now"><span class="guide-now-label">NOW</span><span id="guideNowTime">${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></div>` +
      Array.from({ length: slots }, (_, i) => `<div>${fmt(new Date(guideStart + i * step))}</div>`).join("");
  }
  grid.innerHTML = "";
  channels.forEach(c => {
    const active = current && current.number === c.number;
    const row = document.createElement("div");
    row.className = "epg-row" + (active ? " active" : "") + (c.premium ? " premium" : "");
    row.dataset.number = String(c.number);
    row.innerHTML = `<div class="guide-station"><span class="guide-ch">${String(c.number).padStart(2,"0")}</span><span class="guide-call" title="${escapeHtml(c.name)}">${escapeHtml(guideStationName(c))}</span></div><div class="guide-programs"></div>`;
    const progWrap = row.querySelector(".guide-programs");
    const entries = guideSchedule(c, guideStart, guideEnd);
    const guideMs = guideEnd - guideStart;
    for (const entry of entries) {
      const startPct = Math.max(0, (entry.start - guideStart) / guideMs * 100);
      const endPct = Math.min(100, (entry.end - guideStart) / guideMs * 100);
      if (endPct <= startPct) continue;
      const block = document.createElement("div");
      block.className = "guide-program";
      if (entry.start < guideStart) block.classList.add("continues-left");
      if (entry.end > guideEnd) block.classList.add("continues-right");
      if (now >= entry.start && now < entry.end) block.classList.add("current");
      block.style.left = `${startPct}%`;
      block.style.width = `${endPct - startPct}%`;
      const title = document.createElement("span");
      title.className = "guide-program-title" + (active && now >= entry.start && now < entry.end ? " epg-show" : "");
      title.textContent = entry.title;
      title.title = entry.title;
      block.appendChild(title);
      progWrap.appendChild(block);
    }
    if (!progWrap.children.length) {
      const block = document.createElement("div");
      block.className = "guide-program";
      block.style.left = "0";
      block.style.width = "100%";
      const title = document.createElement("span");
      title.className = "guide-program-title";
      title.textContent = programFor(c, now).title;
      block.appendChild(title);
      progWrap.appendChild(block);
    }
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
  const panel = document.getElementById("epgPanel");
  panel.classList.toggle("open");
  if (panel.classList.contains("open")) renderEPG();
});
document.getElementById("guideClose").addEventListener("click", () => {
  document.getElementById("epgPanel").classList.remove("open");
});
document.getElementById("geoBtn").addEventListener("click", detectGeo);
document.getElementById("premiumBtn").addEventListener("click", () => {
  premiumOn = !premiumOn;
  document.getElementById("premiumBtn").textContent = `Premium: ${premiumOn ? "On" : "Off"}`;
  document.getElementById("premiumBtn").classList.toggle("on", premiumOn);
  rebuildChannels();
});
document.getElementById("eraBtn").addEventListener("click", () => {
  tvEra = tvEra === "90s" ? "2000s" : "90s";
  writePreference(THEME_KEYS.era, tvEra);
  applyTheme();
});
document.getElementById("fxBtn").addEventListener("click", () => {
  crtOn = !crtOn;
  writePreference(THEME_KEYS.fx, crtOn ? "on" : "off");
  applyTheme();
});
document.getElementById("tubeBtn").addEventListener("click", () => {
  tubeOn = !tubeOn;
  writePreference(THEME_KEYS.tube, tubeOn ? "on" : "off");
  applyTheme();
});

premiumChannels.forEach(c => (c.items || []).forEach(it => { it.title = cleanTitle(it.title); }));
applyTheme({ render: false });
rebuildChannels();
detectGeo();
preloadSpelunkr();
preloadArchive();
setInterval(renderEPG, 30000);
setInterval(updateGuideClock, 1000);

