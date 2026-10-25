import json, urllib.request, urllib.parse, time, re

TV_BASE = 'collection:television AND year:[1990 TO 2009] AND ('
MOVIE_BASE = 'collection:feature_films AND year:[1990 TO 2009] AND (language:English OR language:eng OR language:en-us OR language:en)'
ENGLISH_LANGS = ("english", "eng", "en-us", "en-gb", "en")

BAD_PREFIX = ("funny_or_die_video_", "youtube-", "twitter-", "miraheze-", "roosterteeth-",
              "httparchive_", "fav-", "thingiverse-", "opencontext-", "file-", "movie-")
BAD_WORDS = ("funny or die", "rooster teeth", "httparchive", "miraheze", "favorites",
             "episode 4 aftershow", "house of the dragon")
FOREIGN_MARKERS = ("turkish movie", "audio latino", "english sub", "subtitled", "subtitles",
                   "english subtitles", "vose", "castellano", "german movie", "french movie",
                   "spanish movie", "italian movie", "japanese movie", "korean movie",
                   "thai movie", "hindi movie", "bollywood", "latino", "espanol", "español",
                   "german language", "french language", "italian language", "spanish language")
NON_MOVIE_MARKERS = ("documentary", "national geographic", "nova", "biography", "e! true hollywood",
                     "behind the music", "x games", "promo", "trailer", "commercial", "making of",
                     "behind the scenes", "interview", "commentary", "supplementary", "featurette",
                     "short film", "looney tunes", "mickey", "cartoon", "anime", "ova", "music video",
                     "concert", "stand-up", "stand up", "comedy special", "gameplay", "let's play",
                     "viagrafix", "using word", "tutorial", "instructional", "software training",
                     "geekjuicemedia", "complete series", "tales from the darkside",
                     "zeitgeist", "steal this film", "century of the self", "battle of china",
                     "route 66", "between hurricanes")
ANIMATION_MARKERS = ("animation", "animated", "cartoon", "looney tunes")

TV_SHOWS = {
 "sitcom": ["Murphy Brown","Frasier","Friends","Seinfeld","Cheers","Roseanne","Home Improvement","The Nanny","NewsRadio","Will & Grace","3rd Rock from the Sun","Spin City","Dharma & Greg","Everybody Loves Raymond","The King of Queens","That '70s Show","The Fresh Prince of Bel-Air","Family Matters","Full House","Boy Meets World","Saved by the Bell","Married... with Children","Mad About You","Wings","Coach","The Golden Girls","Designing Women","The Drew Carey Show","Cybill","Ellen","The Larry Sanders Show","Veronica's Closet","Caroline in the City","Suddenly Susan","Grace Under Fire","Just Shoot Me"],
 "drama_tv": ["ER","The X-Files","X-Files","Buffy the Vampire Slayer","Charmed","Dawson's Creek","Party of Five","Melrose Place","Beverly Hills, 90210","Twin Peaks","NYPD Blue","Law & Order","Homicide: Life on the Street","Chicago Hope","The Practice","Ally McBeal","Providence","Once and Again","thirtysomething","Quantum Leap","Northern Exposure","Picket Fences","Sisters","L.A. Law","Murder One","The Commish","Felicity","Profiler","The Sentinel","Highlander","Xena: Warrior Princess","Hercules: The Legendary Journeys","Babylon 5","Stargate SG-1","SeaQuest DSV","Sliders","Viper","TekWar"],
 "soaps": ["General Hospital","All My Children","Days of Our Lives","EastEnders","Coronation Street","One Life to Live","Guiding Light","As the World Turns","Passions","The Young and the Restless","The Bold and the Beautiful","Another World","Santa Barbara","Sunset Beach","Port Charles"],
 "docs": ["Biography","NOVA","Nature","Frontline","E! True Hollywood Story","Behind the Music","American Experience","Unsolved Mysteries","Rescue 911","48 Hours","Investigative Reports","The Directors","Biography Channel"],
 "cartoons": ["South Park","Duckman","Dilbert","Home Movies","Family Dog","Raw Toonage","The Moxy Show","Voltron","Ivanhoe","Cartoon Sushi","Beavis and Butt-Head","Daria","King of the Hill","The Simpsons","Rugrats","The Ren & Stimpy Show","Rocko's Modern Life","Hey Arnold!","The Powerpuff Girls","Dexter's Laboratory","Johnny Bravo","Cartoon Network","Looney Tunes","Tiny Toon Adventures","Animaniacs","Pinky and the Brain","Freakazoid!","Spider-Man","X-Men"],
 "kids": ["Barney & Friends","Sesame Street","Mister Rogers' Neighborhood","Reading Rainbow","Blue's Clues","Power Rangers","Nick Arcade","Guts","Double Dare","Legends of the Hidden Temple","Are You Afraid of the Dark?","Clarissa Explains It All","Salute Your Shorts","The Adventures of Pete & Pete"],
 "gameshows": ["The Price Is Right","Jeopardy!","Jeopardy","Wheel of Fortune","Family Feud","Double Dare","Legends of the Hidden Temple","Nick Arcade","Guts","American Gladiators","Studs","Love Connection","The Weakest Link","Who Wants to Be a Millionaire","Deal or No Deal"],
 "reality": ["The Real World","Survivor","Big Brother","The Amazing Race","The Jerry Springer Show","Maury","Road Rules","Elimidate","Blind Date","Cops","America's Most Wanted","Rescue 911"],
 "talk": ["The Oprah Winfrey Show","Oprah","Donahue","Sally Jessy Raphael","Montel Williams","Ricki Lake","The Jerry Springer Show","Late Show with David Letterman","The Tonight Show","Maury","Late Night with Conan O'Brien","The View","Live with Regis and Kathie Lee"],
 "news": ["60 Minutes","Dateline NBC","Dateline","20/20","Nightline","Meet the Press","The Today Show","Today","Good Morning America","World News Tonight","CBS Evening News","NBC Nightly News","ABC World News"],
 "music": ["MTV","VH1","120 Minutes","Total Request Live","Headbangers Ball","Beavis and Butt-Head","The Real World","Top of the Pops","Behind the Music"],
 "wrestling": ["WWF","WCW","WWE","ECW","Raw is War","Monday Night Nitro","SmackDown","Monday Night Raw"],
 "british": ["EastEnders","Coronation Street","Fawlty Towers","Mr. Bean","Blackadder","Red Dwarf","Allo Allo","Keeping Up Appearances","Are You Being Served?","Yes Minister"],
 "crime": ["Law & Order","NYPD Blue","Homicide: Life on the Street","CSI: Crime Scene Investigation","CSI","Cold Case","Cops","America's Most Wanted","Profiler","Diagnosis Murder","Murder, She Wrote","Matlock"],
 "medical": ["ER","Chicago Hope","St. Elsewhere","Doogie Howser, M.D.","General Hospital","Trapper John, M.D.","Northern Exposure"],
 "legal": ["Law & Order","The Practice","Ally McBeal","Boston Legal","L.A. Law","JAG","Perry Mason","Matlock"],
 "home": ["This Old House","Hometime","Bob Ross","The Joy of Painting","The New Yankee Workshop","Home Again"],
 "cooking": ["Julia Child","Emeril Live","Emeril","Iron Chef","Ready Set Cook","Molto Mario","Two Fat Ladies","Cooking with","Chef"],
 "travel": ["Lonely Planet","Travel","Timecop","Quantum Leap","Globe Trekker","Rick Steves","Great Hotels","Passport to"],
 "history": ["History","Time Team","Modern Marvels","Biography","American Experience","The Revolution","Liberty!","Civil War","The World at War"],
 "truecrime": ["Forensic Files","Unsolved Mysteries","America's Most Wanted","Rescue 911","48 Hours","Cold Case Files","The FBI Files","New Detectives"],
 "science": ["NOVA","Scientific American Frontiers","Newton's Apple","Nature","The Nature of Things","Discover Magazine","Beyond 2000"],
 "sports": ["American Gladiators","Roller Derby","Wide World of Sports","Monday Night Football","NBA","NFL","Baseball Tonight","SportsCenter","X Games","Survivor Series","Royal Rumble"],
 "cult_tv": ["The Twilight Zone","The Outer Limits","Tales from the Crypt","Sightings","The Prisoner","Twin Peaks","The X-Files","X-Files","Kolchak","Dark Shadows"],
 "scifi_tv": ["The X-Files","X-Files","Star Trek","Babylon 5","Stargate SG-1","SeaQuest DSV","Sliders","Quantum Leap","Battlestar Galactica","Farscape","Lexx","Earth: Final Conflict","The Outer Limits"],
 "anime": ["Sailor Moon","Dragon Ball","Gundam","Pokemon","Digimon","Tenchi","Cowboy Bebop","Evangelion"],
}
TV_MIN_RUNTIME = {
 "sitcom": 900, "drama_tv": 1200, "soaps": 1200, "docs": 900, "cartoons": 480,
 "kids": 480, "gameshows": 900, "reality": 900, "talk": 900, "news": 600,
 "music": 180, "wrestling": 1200, "british": 900, "crime": 1200, "medical": 1200,
 "legal": 1200, "home": 600, "cooking": 600, "travel": 600, "history": 900,
 "truecrime": 900, "science": 900, "sports": 1200, "cult_tv": 900, "scifi_tv": 900,
 "anime": 480,
}
TV_NON_SHOW = ("promo", "commercial", "advert", "trailer", "teaser", "ident", "bumper",
               "sponsorship", "coming up", "next week", "behind the scenes", "interview",
               "commentary", "making of", "promo break", "network promo", "sneak peek",
               "signpost", "ratings classification", "closing logo", "opening logo",
               "theme song", "sign off", "sign on", "subs", "subbed", "subtitled",
               "raw footage", "raw capture", "set tour", "preview", "tribute",
               "theme", "intro", "sponsor appreciation", "nova scotia")
FOREIGN_SUBJECT = ("italian", "french", "german", "russian", "soviet", "turkish",
                   "spanish", "japanese", "korean", "chinese", "thai", "hindi",
                   "bollywood", "foreign film", "world cinema", "documentary",
                   "documentary film", "nonfiction", "nature", "biography", "swedish",
                   "danish", "dutch", "polish", "czech", "hungarian", "portuguese",
                   "brazilian", "argentinian", "mexican", "latin")
ANIMATION_SUBJECT = ("animation", "animated", "cartoon", "anime", "short film")

def strip_leading_meta(title):
    t = title.strip().lower()
    t = re.sub(r"^(19|20)\d{2}[\s\.\-–:]*", "", t)
    return t

def title_matches_show(title, shows):
    t = strip_leading_meta(title)
    for s in shows:
        sl = s.lower()
        if t.startswith(sl):
            rest = t[len(sl):len(sl)+1]
            if rest == "" or rest in " :(-–—/.,!?":
                return True
    return False

TV_QUERIES = {
 "sitcom": 'collection:television AND year:[1990 TO 2009] AND (title:"Murphy Brown" OR title:Frasier OR title:Friends OR title:Seinfeld OR title:Cheers OR title:Roseanne OR title:"Home Improvement" OR title:"The Nanny" OR title:NewsRadio OR title:"Will & Grace" OR title:"3rd Rock" OR title:"Spin City" OR title:"Dharma & Greg" OR title:"Everybody Loves Raymond" OR title:"King of Queens" OR title:"That 70s Show" OR title:"Fresh Prince" OR title:"Family Matters" OR title:"Full House" OR title:"Boy Meets World" OR title:"Saved by the Bell" OR title:"Married with Children" OR title:"Mad About You" OR title:Wings OR title:Coach OR title:"Golden Girls" OR title:"Designing Women" OR title:"Drew Carey" OR title:Cybill OR title:Ellen OR title:"Larry Sanders" OR title:"Veronica\'s Closet" OR title:"Caroline in the City" OR title:"Suddenly Susan" OR title:"Grace Under Fire" OR title:"Just Shoot Me")',
 "drama_tv": 'collection:television AND year:[1990 TO 2009] AND (title:"ER" OR title:"X-Files" OR title:Buffy OR title:Charmed OR title:Dawson OR title:"Party of Five" OR title:"Melrose Place" OR title:"Beverly Hills" OR title:"Twin Peaks" OR title:"NYPD Blue" OR title:"Law & Order" OR title:Homicide OR title:"Chicago Hope" OR title:"The Practice" OR title:"Ally McBeal" OR title:Providence OR title:"Once and Again" OR title:"thirtysomething" OR title:"Quantum Leap" OR title:"Northern Exposure" OR title:"Picket Fences" OR title:Sisters OR title:"L.A. Law" OR title:"Murder One" OR title:"The Commish" OR title:"Sisters" OR title:"Felicity" OR title:"Profiler" OR title:"The Sentinel" OR title:"Highlander" OR title:"Xena" OR title:"Hercules" OR title:"Babylon 5" OR title:"Stargate" OR title:"SeaQuest" OR title:"Sliders" OR title:"Viper" OR title:"TekWar")',
 "soaps": 'collection:television AND year:[1990 TO 2009] AND (title:"General Hospital" OR title:"All My Children" OR title:"Days of Our Lives" OR title:EastEnders OR title:"Coronation Street" OR title:"One Life to Live" OR title:"Guiding Light" OR title:"As the World Turns" OR title:Passions OR title:"Young and the Restless" OR title:"Bold and the Beautiful" OR title:"Another World" OR title:"Santa Barbara" OR title:"Sunset Beach" OR title:"Port Charles")',
 "docs": 'collection:television AND year:[1990 TO 2009] AND (title:Biography OR title:NOVA OR title:Nature OR title:Frontline OR title:"E! True Hollywood" OR title:"Behind the Music" OR title:"American Experience" OR title:"Unsolved Mysteries" OR title:"Rescue 911" OR title:"48 Hours" OR title:"Investigative Reports" OR title:"The Directors" OR title:"Biography Channel")',
 "cartoons": 'collection:television AND year:[1990 TO 2009] AND (title:"South Park" OR title:Duckman OR title:Dilbert OR title:"Home Movies" OR title:"Family Dog" OR title:"Raw Toonage" OR title:Moxy OR title:Voltron OR title:Ivanhoe OR title:"Cartoon Sushi" OR title:Beavis OR title:Daria OR title:"King of the Hill" OR title:Simpsons OR title:Rugrats OR title:"Ren & Stimpy" OR title:Rocko OR title:"Hey Arnold" OR title:Powerpuff OR title:Dexter OR title:"Johnny Bravo" OR title:"Cartoon Network" OR title:"Looney Tunes" OR title:"Tiny Toon" OR title:"Animaniacs" OR title:"Pinky and the Brain" OR title:"Freakazoid" OR title:"Spider-Man" OR title:"X-Men")',
 "kids": 'collection:television AND year:[1990 TO 2009] AND (title:Barney OR title:"Sesame Street" OR title:"Mister Rogers" OR title:"Reading Rainbow" OR title:"Blues Clues" OR title:"Power Rangers" OR title:"Nick Arcade" OR title:Guts OR title:"Double Dare" OR title:"Legends of the Hidden Temple" OR title:"Are You Afraid of the Dark" OR title:"Clarissa Explains It All" OR title:"Salute Your Shorts" OR title:"Pete & Pete")',
 "gameshows": 'collection:television AND year:[1990 TO 2009] AND (title:"Price Is Right" OR title:Jeopardy OR title:"Wheel of Fortune" OR title:"Family Feud" OR title:"Double Dare" OR title:"Legends of the Hidden Temple" OR title:"Nick Arcade" OR title:Guts OR title:"American Gladiators" OR title:Studs OR title:"Love Connection" OR title:"The Weakest Link" OR title:"Who Wants to Be a Millionaire" OR title:"Deal or No Deal")',
 "reality": 'collection:television AND year:[1990 TO 2009] AND (title:"Real World" OR title:Survivor OR title:"Big Brother" OR title:"Amazing Race" OR title:"Jerry Springer" OR title:Maury OR title:"Road Rules" OR title:Elimidate OR title:"Blind Date" OR title:"Cops" OR title:"America\'s Most Wanted" OR title:"Rescue 911")',
 "talk": 'collection:television AND year:[1990 TO 2009] AND (title:Oprah OR title:Donahue OR title:"Sally Jessy" OR title:Montel OR title:"Ricki Lake" OR title:"Jerry Springer" OR title:"Late Show" OR title:"Tonight Show" OR title:Maury OR title:"Late Night" OR title:"The View" OR title:"Live with Regis")',
 "news": 'collection:television AND year:[1990 TO 2009] AND (title:"60 Minutes" OR title:Dateline OR title:"20/20" OR title:Nightline OR title:"Meet the Press" OR title:"Today Show" OR title:"Good Morning America" OR title:"World News Tonight" OR title:"CBS Evening News" OR title:"NBC Nightly News" OR title:"ABC World News")',
 "music": 'collection:television AND year:[1990 TO 2009] AND (title:MTV OR title:VH1 OR title:"120 Minutes" OR title:"Total Request" OR title:Headbangers OR title:"Beavis and Butthead" OR title:"Real World" OR title:"Top of the Pops" OR title:"Behind the Music")',
 "wrestling": 'collection:television AND year:[1990 TO 2009] AND (title:WWF OR title:WCW OR title:WWE OR title:"Raw is War" OR title:"Monday Night Nitro" OR title:ECW OR title:SmackDown OR title:"Monday Night Raw")',
 "british": 'collection:television AND year:[1990 TO 2009] AND (title:EastEnders OR title:"Coronation Street" OR title:"Fawlty Towers" OR title:"Mr. Bean" OR title:Blackadder OR title:"Red Dwarf" OR title:"Allo Allo" OR title:"Keeping Up Appearances" OR title:"Are You Being Served" OR title:"Yes Minister")',
 "crime": 'collection:television AND year:[1990 TO 2009] AND (title:"Law & Order" OR title:"NYPD Blue" OR title:Homicide OR title:CSI OR title:"Cold Case" OR title:Cops OR title:"America\'s Most Wanted" OR title:"Profiler" OR title:"Diagnosis Murder" OR title:"Murder, She Wrote" OR title:"Matlock")',
 "medical": 'collection:television AND year:[1990 TO 2009] AND (title:"ER" OR title:"Chicago Hope" OR title:"St. Elsewhere" OR title:Doogie OR title:"General Hospital" OR title:"Trapper John" OR title:"Northern Exposure")',
 "legal": 'collection:television AND year:[1990 TO 2009] AND (title:"Law & Order" OR title:"The Practice" OR title:"Ally McBeal" OR title:"Boston Legal" OR title:"L.A. Law" OR title:"JAG" OR title:"Perry Mason" OR title:"Matlock")',
 "home": 'collection:television AND year:[1990 TO 2009] AND (title:"This Old House" OR title:Hometime OR title:"Bob Ross" OR title:"Joy of Painting" OR title:"This Old House Hour" OR title:"New Yankee Workshop" OR title:"Home Again")',
 "cooking": 'collection:television AND year:[1990 TO 2009] AND (title:"Julia Child" OR title:Emeril OR title:"Iron Chef" OR title:"Ready Set Cook" OR title:"Molto Mario" OR title:"Two Fat Ladies" OR title:"Cooking with" OR title:"Chef")',
 "travel": 'collection:television AND year:[1990 TO 2009] AND (title:"Lonely Planet" OR title:Travel OR title:"Timecop" OR title:"Quantum Leap" OR title:"Globe Trekker" OR title:"Rick Steves" OR title:"Great Hotels" OR title:"Passport to")',
 "history": 'collection:television AND year:[1990 TO 2009] AND (title:History OR title:"Time Team" OR title:"Modern Marvels" OR title:Biography OR title:"American Experience" OR title:"The Revolution" OR title:"Liberty!" OR title:"Civil War" OR title:"The World at War")',
 "truecrime": 'collection:television AND year:[1990 TO 2009] AND (title:"Forensic Files" OR title:"Unsolved Mysteries" OR title:"America\'s Most Wanted" OR title:"Rescue 911" OR title:"48 Hours" OR title:"Cold Case Files" OR title:"The FBI Files" OR title:"New Detectives")',
 "science": 'collection:television AND year:[1990 TO 2009] AND (title:NOVA OR title:"Scientific American" OR title:"Newtons Apple" OR title:Nature OR title:"The Nature of Things" OR title:"Discover Magazine" OR title:"Beyond 2000")',
 "sports": 'collection:television AND year:[1990 TO 2009] AND (title:"American Gladiators" OR title:"Roller Derby" OR title:"Wide World of Sports" OR title:"Monday Night Football" OR title:"NBA" OR title:"NFL" OR title:"Baseball Tonight" OR title:"SportsCenter" OR title:"X Games" OR title:"Survivor Series" OR title:"Royal Rumble")',
 "cult_tv": 'collection:television AND year:[1990 TO 2009] AND (title:"Twilight Zone" OR title:"Outer Limits" OR title:"Tales from the Crypt" OR title:"Sightings" OR title:"The Prisoner" OR title:"Twin Peaks" OR title:"X-Files" OR title:"Kolchak" OR title:"Dark Shadows")',
 "scifi_tv": 'collection:television AND year:[1990 TO 2009] AND (title:"X-Files" OR title:"Star Trek" OR title:"Babylon 5" OR title:"Stargate" OR title:"SeaQuest" OR title:"Sliders" OR title:"Quantum Leap" OR title:"Battlestar Galactica" OR title:"Farscape" OR title:"Lexx" OR title:"Earth: Final Conflict" OR title:"The Outer Limits")',
 "anime": 'collection:television AND year:[1990 TO 2009] AND (title:"Sailor Moon" OR title:"Dragon Ball" OR title:Gundam OR title:Pokemon OR title:Digimon OR title:Tenchi OR title:"Cowboy Bebop" OR title:Evangelion)',
}

# Specific broad queries for gaming / tech clips.
CLIP_QUERIES = {
 "gaming": '(title:"Attack of the Show" OR title:"X-Play" OR title:"Screen Savers" OR title:"Extended Play" OR title:"Call for Help" OR title:"TechTV" OR title:"G4" OR title:"Cinematech" OR title:"Filter" OR title:"Icons" OR title:"Judgment Day" OR title:"Arena" OR title:"Electric Playground" OR title:"g4tv") AND mediatype:movies',
 "tech": '(title:TechTV OR title:"Computer Chronicles" OR title:"Screen Savers" OR title:"Digital Duo" OR title:"Call for Help" OR title:TechLive OR title:ZDTV OR title:"Computer" OR title:"Internet" OR title:"Microsoft") AND mediatype:movies',
 "esports": '(title:esports OR title:"competitive gaming" OR subject:esports OR title:"Cyberathlete" OR title:"Major League Gaming" OR title:"MLG") AND mediatype:movies',
 "extreme": '(subject:"extreme sports" OR title:"X Games" OR title:Surf OR title:Skate OR title:BMX OR title:Motocross OR title:Snowboard) AND mediatype:movies',
}

SUBJECT_GENRES = {
 "horror": ("horror",),
 "action": ("action", "adventure", "martial arts"),
 "comedy_movies": ("comedy", "romantic comedy"),
 "drama_movies": ("drama",),
 "thriller": ("thriller", "suspense"),
 "romance": ("romance", "romantic"),
 "western": ("western", "westerns"),
 "family": ("family", "children", "kids"),
 "fantasy": ("fantasy",),
 "scifi": ("science fiction", "sci-fi", "science-fiction"),
 "indie": ("independent", "indie"),
}

def fetch(q, rows=400):
    url = "https://archive.org/advancedsearch.php?q=" + urllib.parse.quote(q) + \
          "&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=language&fl%5B%5D=subject&fl%5B%5D=runtime&rows=" + str(rows) + "&output=json"
    req = urllib.request.Request(url, headers={"User-Agent": "Tvgrid/1.0"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.load(r)["response"]["docs"]

def norm_subjects(d):
    s = d.get("subject") or []
    if isinstance(s, str): s = [s]
    return " ".join(str(x) for x in s).lower()

def english_ok(d, require=True, allow_unknown=True):
    lang = str(d.get("language") or "").lower().strip()
    if not lang:
        return allow_unknown
    if "subtitle" in lang:
        return False
    parts = [p.strip() for p in re.split(r"[/,;|]", lang) if p.strip()]
    if not parts:
        return allow_unknown
    ok = [p for p in parts if any(x in p for x in ENGLISH_LANGS)]
    if require and len(ok) != len(parts):
        return False
    if not ok:
        return False
    return True

FOREIGN_PREFIXES = ("der ", "die ", "das ", "les ", "le ", "la ", "el ", "los ", "las ",
                    "il ", "lo ", "gli ", "un ", "una ", "uno ", "sapore ", "milliardi",
                    "tillbaka", "carne ", "venganza", "muerte", "amor ", "corazon ",
                    "policia ", "tierra ", "sangre ", "mujer ", "cabaret", "niños ",
                    "criminales", "pantalon", "visitadoras", "sotto voce", "arrivederci",
                    "cemento", "sobaka")
FOREIGN_TITLE_MARKERS = ("sapore di donna", "carne fresca", "miliardi", "stalingrad",
                         "wilder dreier", "threesome wild", "rohtenburg", "cannibal (2006)",
                         "chuang wang li zi cheng")
def title_ok(title, movie=False):
    low = title.lower()
    if movie and low.startswith(FOREIGN_PREFIXES): return False
    if movie and any(w in low for w in FOREIGN_TITLE_MARKERS): return False
    if any(w in low for w in BAD_WORDS): return False
    if any(w in low for w in FOREIGN_MARKERS): return False
    nonascii = sum(1 for c in title if ord(c) > 127)
    if nonascii > 2: return False
    if movie and any(w in low for w in NON_MOVIE_MARKERS): return False
    return True

def runtime_seconds(d):
    raw = d.get("runtime") or d.get("length") or ""
    if isinstance(raw, list): raw = raw[0] if raw else ""
    raw = str(raw).strip()
    m = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", raw)
    if not m: return None
    if m.group(3) is not None:
        return int(m.group(1)) * 3600 + int(m.group(2)) * 60 + int(m.group(3))
    return int(m.group(1)) * 60 + int(m.group(2))

def add_item(bucket, d, genre, require_english=False):
    ident = d.get("identifier") or ""
    raw_title = d.get("title") or ""
    if isinstance(raw_title, list): raw_title = raw_title[0] if raw_title else ""
    title = str(raw_title).strip()
    if not ident or not title: return
    if ident.startswith(BAD_PREFIX): return
    movie = genre in SUBJECT_GENRES or genre in ("movies90", "movies00")
    if not title_ok(title, movie=movie): return
    if not english_ok(d, require=require_english): return
    if genre in TV_SHOWS:
        low = title.lower()
        if any(w in low for w in TV_NON_SHOW): return
        if not title_matches_show(title, TV_SHOWS[genre]): return
    if movie:
        subs = norm_subjects(d)
        if any(w in subs for w in FOREIGN_SUBJECT): return
        if genre in ("movies90", "movies00") and any(w in subs for w in ANIMATION_SUBJECT): return
        rt = runtime_seconds(d)
        if rt is not None and rt < 2400: return
    if genre in TV_MIN_RUNTIME:
        rt = runtime_seconds(d)
        if rt is not None and rt < TV_MIN_RUNTIME[genre]: return
    if any(x["id"] == ident for x in bucket): return
    year = d.get("year")
    if isinstance(year, list): year = year[0] if year else None
    try: year = int(year) if year else None
    except: year = None
    bucket.append({"id": ident, "title": title, "year": year, "subjects": norm_subjects(d)})

catalog = {k: [] for k in TV_QUERIES}
catalog.update({k: [] for k in CLIP_QUERIES})
catalog["movies90"] = []
catalog["movies00"] = []

for genre, q in TV_QUERIES.items():
    try:
        docs = fetch(q)
    except Exception as e:
        print("ERR", genre, e); docs = []
    for d in docs:
        add_item(catalog[genre], d, genre, require_english=True)
    print(genre, len(catalog[genre]))
    time.sleep(0.1)

for genre, q in CLIP_QUERIES.items():
    try:
        docs = fetch(q)
    except Exception as e:
        print("ERR", genre, e); docs = []
    for d in docs:
        ident = (d.get("identifier") or "").lower()
        title = (d.get("title") or "").lower()
        hay = ident + " " + title
        if genre == "gaming":
            if not any(k in hay for k in ["g4", "x-play", "xplay", "screen savers", "attack of the show", "extended play", "call for help", "techtv", "cinematech", "filter", "icons", "judgment day", "electric playground", "arena"]):
                continue
        elif genre == "tech":
            if not any(k in hay for k in ["techtv", "computer chronicles", "screen savers", "digital duo", "call for help", "techlive", "zdtv", "computer", "internet", "microsoft", "pc "]):
                continue
        elif genre == "esports":
            if not any(k in hay for k in ["esport", "competitive gaming", "cyberathlete", "major league gaming", "mlg", "g4", "x-play"]):
                continue
        elif genre == "extreme":
            if not any(k in hay for k in ["x games", "surf", "skate", "bmx", "motocross", "snowboard", "extreme"]):
                continue
        add_item(catalog[genre], d, genre, require_english=True)
    print(genre, len(catalog[genre]))
    time.sleep(0.1)

# Movies: pull all English feature films in each decade, then classify by subject tags.
for decade, q in (("movies90", 'collection:feature_films AND year:[1990 TO 1999] AND (language:English OR language:eng OR language:en-us OR language:en)'),
                  ("movies00", 'collection:feature_films AND year:[2000 TO 2009] AND (language:English OR language:eng OR language:en-us OR language:en)')):
    try:
        docs = fetch(q, rows=600)
    except Exception as e:
        print("ERR", decade, e); docs = []
    for d in docs:
        add_item(catalog[decade], d, decade, require_english=True)
    print(decade, len(catalog[decade]))
    time.sleep(0.1)

for g in SUBJECT_GENRES:
    catalog[g] = []
    for decade in ("movies90", "movies00"):
        for it in catalog[decade]:
            subs = it["subjects"]
            if any(k in subs for k in SUBJECT_GENRES[g]):
                catalog[g].append(it)

# remove animated shorts from live-action movie genres (keep family)
for g in ("horror","action","comedy_movies","drama_movies","thriller","romance","western","scifi","indie"):
    catalog[g] = [it for it in catalog[g] if not any(k in it["subjects"] for k in ANIMATION_MARKERS)]

for g in catalog:
    print(g, len(catalog[g]))

json.dump(catalog, open("catalog.json","w"), indent=2)
print("wrote catalog", sum(len(v) for v in catalog.values()), "items")
