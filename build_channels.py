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

archive_items = [
 ("all-my-children-may-8-1992-most","All My Children"),
 ("the-ghost-busters-1975","Ghost Busters"),
 ("Last-of-the-Summer-Wine-Series-5","Last of the Summer Wine"),
 ("TheMartinShortShowEp.2TheSteveMartinShow","Martin Short Show"),
 ("americas-funniest-people-balancing-acts-1990","America's Funniest People"),
 ("swiss-family-robinson-1974","Swiss Family Robinson"),
 ("inside-the-dream-factory-1995","Inside The Dream Factory"),
 ("ArkIIEpisode1TheFlies1976","Ark II"),
 ("bob-hopes-cross-country-xmas-show-1991","Bob Hope Xmas"),
 ("the-new-leave-it-to-beaver-still-the-beaver-1984-1989","Leave It To Beaver"),
 ("the-amazing-spider-man-1977-complete-series_202301","Amazing Spider-Man"),
 ("zoe-duncan-jack-and-jane-complete-series","Zoe Duncan Jack Jane"),
 ("slap-maxwell-story-1.01","Slap Maxwell"),
 ("episode-3-air-lock","Doctor Who"),
 ("1950sTelevisionCommercialBlueMagicCheerad1","1950s TV Commercials"),
 ("1952-RollerDerby-TheJoltersVsTheChiefs_105","Roller Derby"),
]
for ident, title in archive_items:
    channels.append({
        "number": num, "id": f"archive-{ident}", "name": title, "category": "Archive TV",
        "group": "archive", "mode": "archive", "ident": ident, "src": f"https://archive.org/details/{ident}",
        "description": f"Archive.org classic TV: {title}"
    })
    num += 1

assert len(channels) == 70, len(channels)
with open("channels.json","w") as f:
    json.dump(channels, f, indent=2)
with open("channels.js","w") as f:
    f.write("window.CHANNELS = " + json.dumps(channels, indent=2) + ";\n")
print("count", len(channels))
