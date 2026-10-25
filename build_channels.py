import json, random, re

CATALOG = json.load(open("catalog.json"))
EPOCH = 1577836800000  # 2020-01-01T00:00:00Z
MOVIE_GENRES = {"movies90","movies00","horror","scifi","action","comedy_movies","drama_movies",
                "romance","thriller","western","family","indie","fantasy"}

def show_key(title):
    t = (title or "").lower()
    t = re.sub(r"^[^a-z0-9]+", "", t)
    if "g4" in t:
        if re.search(r"g4[_-]?(xp|xp\d)", t) or "x-play" in t: return "x-play"
        if re.search(r"g4[_-]?as", t) or "attack of the show" in t: return "attack of the show"
        if "cinematech" in t: return "cinematech"
        if "filter" in t: return "filter"
        if "icons" in t: return "icons"
        if "judgment day" in t: return "judgment day"
        if "electric playground" in t: return "electric playground"
        return "g4"
    for pat in ["screen savers","computer chronicles","cnn money","techtv","extended play",
                "call for help","next step","digital duo"]:
        if pat in t: return pat
    t = re.split(r"\s+-\s+|:\s+|\s+\(|#|\bS\d{1,2}E?\d*|\bSeason\b|\bEpisode\b|\bEp\b|\bPart\b|\||\"", t)[0]
    t = re.sub(r"\b(19[5-9]\d|20[0-2]\d)\b", "", t)
    t = re.sub(r"[^a-z0-9& ]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t or "unknown"

def pick_duration(genre, rng):
    if genre in MOVIE_GENRES:
        return rng.choice([90,95,100,105,110,115,120]) * 60
    if genre in {"soaps","british"}:
        return rng.choice([30,45,45,60]) * 60
    if genre in {"sitcom","cartoons","kids","gameshows"}:
        return rng.choice([22,25,30,30]) * 60
    if genre in {"docs","history","science","news","talk","reality","home","cooking"}:
        return rng.choice([30,45,60]) * 60
    if genre in {"gaming","tech","esports"}:
        return rng.choice([15,20,30]) * 60
    if genre in {"extreme","sports","wrestling"}:
        return rng.choice([45,60,90]) * 60
    if genre in {"crime","medical","legal","cult_tv","scifi_tv","drama_tv","truecrime"}:
        return rng.choice([30,45,60]) * 60
    return rng.choice([30,45,60]) * 60

def build_lineup(pools, target, seed, year_range=None, min_shows=4):
    rng = random.Random(seed)
    seen, items = set(), []
    for g in pools:
        for it in CATALOG.get(g, []):
            if it["id"] in seen: continue
            if year_range:
                y = it.get("year")
                if not y or not (year_range[0] <= y <= year_range[1]): continue
            seen.add(it["id"])
            items.append({"id": it["id"], "title": it["title"], "genre": g})
    if len(items) < 4:
        raise ValueError(f"pool too small: {pools} -> {len(items)}")
    groups = {}
    for it in items:
        groups.setdefault(show_key(it["title"]), []).append(it)
    for k in groups: rng.shuffle(groups[k])
    keys = list(groups); rng.shuffle(keys)
    lineup = []
    while len(lineup) < target and any(groups[k] for k in keys):
        for k in keys:
            if len(lineup) >= target: break
            if groups[k]:
                lineup.append(groups[k].pop())
    # interleave so the same show never runs back to back
    out, last = [], None
    remaining = lineup[:]
    while remaining:
        for i, it in enumerate(remaining):
            k = show_key(it["title"])
            if k != last:
                out.append(remaining.pop(i)); last = k; break
        else:
            out.append(remaining.pop(0))
    unique = len({show_key(x["title"]) for x in out})
    if unique < min_shows:
        raise ValueError(f"only {unique} unique shows for {pools}")
    schedule = [{"id": it["id"], "title": it["title"],
                 "duration": pick_duration(it["genre"], rng)} for it in out]
    return schedule

channels = []
num = 1

local_defaults = [
  ("Local News", "Regional news and weather", "sttvmi-NEWS_9.24.2018_-_TARA_S_WALK"),
  ("Local Government", "City council and public meetings", "ffmcia-City_Council_2-24-20"),
  ("Community Access", "Public access television", "planning-board-september-28-2016_202511"),
  ("Local Events", "Town events and gatherings", "orcavt-Montpelier_Community_Carol_Sing_-_December_9_2023_MCCS"),
  ("Local Sports", "Area sports and school games", "07.11.2023_Marshall_City_Council_Meeting"),
  ("Local History", "Regional history and stories", "nh-outlook-2002-01-21"),
  ("Local Culture", "Local arts and culture", "policing-with-the-people-june-2-2025"),
  ("Local Music", "Area musicians and performances", "trcwi-City_of_Ripon_Common_Council_08-25-25"),
  ("Neighborhood", "Neighborhood stories", "vmawi-Eau_Claire_City_Council_Meeting_-_September_24_25_2018"),
  ("Local Voices", "Community voices and interviews", "pacmd-Wicomico_County_Executive_Press_Conference_09_19_24"),
]
local_sched = [{"id": ident, "title": name, "duration": 2700} for name, desc, ident in local_defaults]
for i, (name, desc, ident) in enumerate(local_defaults):
    schedule = local_sched[i:] + local_sched[:i]
    channels.append({
        "number": num, "id": f"local-{num}", "name": name, "category": "Local",
        "group": "local", "mode": "archive", "ident": ident, "src": f"https://archive.org/details/{ident}",
        "description": desc, "premium": False, "epoch": EPOCH, "schedule": schedule
    })
    num += 1

vaughn = ["nickpicks","ogfamilycartoons","crab","ricardoandmortimer","cnclassic","exported",
          "ogfamilyanime","supernaturally","krazykaz","pinkdogfan1","thatsodisney","altoids_001"]
for v in vaughn:
    channels.append({
        "number": num, "id": f"vaughn-{v}", "name": v, "category": "Vaughn Live",
        "group": "vaughn", "mode": "flv", "stream": v,
        "src": f"https://vaughn.live/{v}", "description": f"Vaughn Live channel {v}", "premium": False
    })
    num += 1

channels.append({
    "number": num, "id": "retroblast", "name": "Retroblast", "category": "Retro",
    "group": "retro", "mode": "hls", "src": "https://retroblast.tv/hls/stream.m3u8",
    "description": "Retroblast live HLS stream", "premium": False
})
num += 1

channels.append({
    "number": num, "id": "bongo-tdshuffle", "name": "Bongo TD Shuffle", "category": "Retro",
    "group": "retro", "mode": "external", "src": "https://bongo.stream/tdshuffle",
    "description": "Bongo stream (opens externally)", "premium": False
})
num += 1

spelunkr_slugs = ["saturday-morning","primetime","syndicate","late-nite-local","happy-trees",
                  "computer-chronicles","open-mic","library-card","nature-preserve",
                  "unpaid-programming","radio-active-tv","latchkey-tv","kersplat",
                  "final-frontier","ovatv","toonertia","late-nite-swimclub","homeroom",
                  "mandatory-viewing","fallout-shelter","dusty-trails","gumshoe",
                  "it-came-from","daily-dread","graveyard-shift","ray-gun","signpost",
                  "rubber-hose","suplex","vacation-slides"]
for s in spelunkr_slugs:
    name = s.replace("-"," ").title()
    channels.append({
        "number": num, "id": f"spelunkr-{s}", "name": name, "category": "Spelunkr",
        "group": "spelunkr", "mode": "spelunkr", "slug": s,
        "src": f"https://spelunkr.tv/{s}", "description": f"Spelunkr channel {name}", "premium": False
    })
    num += 1

base_archive = [
  ("Retro Sitcoms", "Comedy", ["sitcom"], 24, None),
  ("Daytime Soaps", "Soaps", ["soaps"], 24, None),
  ("Prime Time Drama", "Drama", ["drama_tv"], 24, None),
  ("90s Movies", "Movies", ["movies90"], 16, None),
  ("2000s Movies", "Movies", ["movies00"], 16, None),
  ("Horror Theater", "Horror", ["horror"], 16, None),
  ("Sci-Fi Zone", "Sci-Fi", ["scifi_tv","scifi"], 24, None),
  ("Action Arena", "Action", ["action"], 16, None),
  ("Comedy Movies", "Movies", ["comedy_movies"], 16, None),
  ("Drama Movies", "Movies", ["drama_movies"], 16, None),
  ("Documentary Channel", "Docs", ["docs","history","science"], 24, None),
  ("Crime TV", "Crime", ["truecrime","crime"], 18, None),
  ("Talk Shows", "Talk", ["talk"], 24, None),
  ("Game Shows", "Game Shows", ["gameshows"], 24, None),
  ("Cartoon Club", "Kids", ["cartoons"], 24, None),
  ("Gaming & Tech", "Gaming", ["gaming","tech"], 24, None),
]

premium_defs = [
  ("Sitcoms 2", "Comedy", ["sitcom"], 24, None),
  ("Sitcoms 3", "Comedy", ["sitcom"], 24, None),
  ("Drama 2", "Drama", ["drama_tv"], 24, None),
  ("Drama 3", "Drama", ["drama_tv"], 24, None),
  ("Soaps 2", "Soaps", ["soaps"], 24, None),
  ("British Telly", "British", ["british"], 24, None),
  ("Cartoons 2", "Kids", ["cartoons"], 24, None),
  ("Cartoons 3", "Kids", ["cartoons"], 24, None),
  ("Kids TV", "Kids", ["kids"], 24, None),
  ("Kids TV 2", "Kids", ["kids"], 24, None),
  ("Game Shows 2", "Game Shows", ["gameshows"], 24, None),
  ("Game Shows 3", "Game Shows", ["gameshows"], 24, None),
  ("Talk Shows 2", "Talk", ["talk"], 24, None),
  ("Talk Shows 3", "Talk", ["talk"], 24, None),
  ("Reality TV", "Reality", ["reality"], 24, None),
  ("Reality TV 2", "Reality", ["reality"], 24, None),
  ("News", "News", ["news"], 24, None),
  ("News 2", "News", ["news"], 24, None),
  ("Wrestling", "Wrestling", ["wrestling"], 24, None),
  ("Wrestling 2", "Wrestling", ["wrestling"], 24, None),
  ("Sports", "Sports", ["sports"], 24, None),
  ("Crime", "Crime", ["crime","truecrime"], 18, None),
  ("Crime 2", "Crime", ["crime","truecrime"], 18, None),
  ("Medical Drama", "Drama", ["medical"], 24, None),
  ("Legal & Crime", "Crime", ["legal","crime"], 18, None),
  ("Sci-Fi TV", "Sci-Fi", ["scifi_tv"], 24, None),
  ("Sci-Fi TV 2", "Sci-Fi", ["scifi_tv"], 24, None),
  ("Cult TV", "Cult", ["cult_tv"], 24, None),
  ("Home & Cooking", "Home", ["home","cooking"], 24, None),
  ("Documentaries 2", "Docs", ["docs","history","science"], 24, None),
  ("Documentaries 3", "Docs", ["docs","history","science"], 24, None),
  ("Horror Movies 2", "Horror", ["horror"], 16, None),
  ("Horror Movies 3", "Horror", ["horror"], 16, None),
  ("90s Horror", "Horror", ["horror"], 12, (1990,1999)),
  ("00s Horror", "Horror", ["horror"], 16, (2000,2009)),
  ("Action Movies 2", "Action", ["action"], 16, None),
  ("Action Movies 3", "Action", ["action"], 16, None),
  ("Action Movies 4", "Action", ["action"], 16, None),
  ("00s Action", "Action", ["action"], 16, (2000,2009)),
  ("Comedy Movies 2", "Movies", ["comedy_movies"], 16, None),
  ("Comedy Movies 3", "Movies", ["comedy_movies"], 16, None),
  ("Comedy Movies 4", "Movies", ["comedy_movies"], 16, None),
  ("00s Comedy", "Movies", ["comedy_movies"], 16, (2000,2009)),
  ("Drama Movies 2", "Movies", ["drama_movies"], 16, None),
  ("Drama Movies 3", "Movies", ["drama_movies"], 16, None),
  ("Thriller Movies", "Thriller", ["thriller"], 16, None),
  ("Thriller Movies 2", "Thriller", ["thriller"], 16, None),
  ("Romance Movies", "Romance", ["romance"], 16, None),
  ("Western Movies", "Western", ["western"], 16, None),
  ("Indie Films", "Movies", ["indie"], 16, None),
]
assert len(premium_defs) == 50, len(premium_defs)

for i, (name, cat, pools, target, yr) in enumerate(base_archive):
    schedule = build_lineup(pools, target, 1000 + i, yr)
    channels.append({
        "number": num, "id": f"archive-{i+1}", "name": name, "category": cat,
        "group": "archive", "mode": "archive", "src": f"https://archive.org/details/{schedule[0]['id']}",
        "description": name + " — multi-show archive channel", "premium": False,
        "epoch": EPOCH, "schedule": schedule
    })
    num += 1

for i, (name, cat, pools, target, yr) in enumerate(premium_defs):
    schedule = build_lineup(pools, target, 5000 + i, yr)
    channels.append({
        "number": num, "id": f"premium-{i+1}", "name": name, "category": cat,
        "group": "premium", "mode": "archive", "src": f"https://archive.org/details/{schedule[0]['id']}",
        "description": name + " — multi-show premium channel", "premium": True,
        "epoch": EPOCH, "schedule": schedule
    })
    num += 1

assert len(channels) == 120, len(channels)

for c in channels:
    if c["mode"] == "archive" and c.get("schedule"):
        n = len({show_key(x["title"]) for x in c["schedule"]})
        print(f'{c["number"]:3} {c["name"]:22} items={len(c["schedule"]):2} shows={n}')

with open("channels.json","w") as f:
    json.dump(channels, f, indent=2)
with open("channels.js","w") as f:
    f.write("window.CHANNELS = " + json.dumps(channels, indent=2) + ";\n")
print("count", len(channels), "premium", sum(1 for c in channels if c["premium"]))
