import json

channels = []
num = 1

local_defaults = [
  ("Local News", "Regional news and weather", "the-ghost-busters-1975"),
  ("Local Weather", "Regional weather and alerts", "the-ghost-busters-1975"),
  ("Local Sports", "Area sports and highlights", "1952-RollerDerby-TheJoltersVsTheChiefs_105"),
  ("Community Access", "Public access television", "Why-1995"),
  ("City Council", "Government meetings", "the-ghost-busters-1975"),
  ("Local Events", "Town hall and community events", "Why-1995"),
  ("Neighborhood", "Community stories", "the-ghost-busters-1975"),
  ("Local Music", "Area musicians and performances", "the-ghost-busters-1975"),
  ("Local History", "Regional history", "the-ghost-busters-1975"),
  ("Local Culture", "Cultural programming", "Why-1995"),
]
for name, desc, ident in local_defaults:
    channels.append({
        "number": num, "id": f"local-{num}", "name": name, "category": "Local",
        "group": "local", "mode": "archive", "ident": ident, "src": f"https://archive.org/details/{ident}",
        "description": desc
    })
    num += 1

vaughn = ["nickpicks","ogfamilycartoons","crab","ricardoandmortimer","cnclassic","exported",
          "ogfamilyanime","supernaturally","krazykaz","pinkdogfan1","thatsodisney","altoids_001"]
for v in vaughn:
    channels.append({
        "number": num, "id": f"vaughn-{v}", "name": v, "category": "Vaughn Live",
        "group": "vaughn", "mode": "flv", "stream": v,
        "src": f"https://vaughn.live/{v}", "description": f"Vaughn Live channel {v}"
    })
    num += 1

channels.append({
    "number": num, "id": "retroblast", "name": "Retroblast", "category": "Retro",
    "group": "retro", "mode": "hls", "src": "https://retroblast.tv/hls/stream.m3u8",
    "description": "Retroblast live HLS stream"
})
num += 1

channels.append({
    "number": num, "id": "bongo-tdshuffle", "name": "Bongo TD Shuffle", "category": "Retro",
    "group": "retro", "mode": "external", "src": "https://bongo.stream/tdshuffle",
    "description": "Bongo stream (opens externally)"
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
        "src": f"https://spelunkr.tv/{s}", "description": f"Spelunkr channel {name}"
    })
    num += 1

genres = json.load(open("genres.json"))
assert len(genres) == 16, len(genres)
for i, g in enumerate(genres):
    items = g["items"]
    channels.append({
        "number": num,
        "id": g["id"],
        "name": g["name"],
        "category": "Genre",
        "group": "genre",
        "mode": "playlist",
        "description": g["description"],
        "startMs": 1704067200000 + (num - 55) * 97 * 60000,
        "startIndex": (i * 3) % max(1, len(items)),
        "items": items,
        "src": f"https://archive.org/details/{items[0]['id']}",
    })
    num += 1

assert len(channels) == 70, len(channels)
with open("channels.json","w") as f:
    json.dump(channels, f, indent=2)
with open("channels.js","w") as f:
    f.write("window.CHANNELS = " + json.dumps(channels, indent=2) + ";\n")
print("count", len(channels))
