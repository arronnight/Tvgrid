import json

channels = []
num = 1

# Seed the local block with real retro newscasts instead of placeholder films.
# The location-aware pass in app.js can still replace these with nearby stations.
local_defaults = [
  ("Retro News", "Retro local newscast from the 1990s and 2000s", "wbbm-080194-10pm-r"),
  ("Retro News 2", "Retro local newscast from the 1990s and 2000s", "wmaq-080194-6pm"),
  ("Retro News 3", "Retro local newscast from the 1990s and 2000s", "wgn-news-at-noon-oct-31-2002-x-264"),
  ("Retro News 4", "Retro local newscast from the 1990s and 2000s", "kron-071692-11pm"),
  ("Retro News 5", "Retro local newscast from the 1990s and 2000s", "kgo-071692-11pm"),
  ("Retro News 6", "Retro local newscast from the 1990s and 2000s", "kpix-071692-10pm"),
  ("Retro News 7", "Retro local newscast from the 1990s and 2000s", "kvue-092791-6pm"),
  ("Retro News 8", "Retro local newscast from the 1990s and 2000s", "whdh-112092-530pm"),
  ("Retro News 9", "Retro local newscast from the 1990s and 2000s", "wcbs-112692-11pm"),
  ("Retro News 10", "Retro local newscast from the 1990s and 2000s", "ktvu-channel-2-news-10-pm-1999"),
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
