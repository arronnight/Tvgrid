import urllib.request, urllib.parse, json, concurrent.futures, re, os

CACHE = '/tmp/opencode/meta_cache.json'
cache = {}
if os.path.exists(CACHE):
    try: cache = json.load(open(CACHE))
    except Exception: cache = {}

BASE = 'mediatype:movies AND year:[1990 TO 2009] AND language:(eng OR English)'

QUERIES = [
    ('cartoon', f'{BASE} AND collection:animationandcartoons', 150),
    ('anime', f'{BASE} AND (subject:(anime) OR title:(anime))', 120),
    ('sitcom', f'{BASE} AND collection:classic_tv AND (subject:(sitcom) OR subject:(situation comedy) OR title:(sitcom) OR title:(comedy series))', 120),
    ('soap', f'{BASE} AND (subject:(soap opera) OR title:(Coronation Street) OR title:(Emmerdale) OR title:(Days of Our Lives) OR title:(Bold and the Beautiful))', 120),
    ('drama_tv', f'{BASE} AND collection:classic_tv AND (subject:(drama) OR subject:(drama series) OR title:(drama))', 140),
    ('scifi', f'{BASE} AND collection:classic_tv AND (subject:(science fiction) OR title:(star trek) OR title:(x-files) OR title:(quantum leap) OR title:(babylon 5) OR title:(stargate) OR title:(farscape) OR title:(sliders) OR title:(outer limits) OR title:(battlestar))', 120),
    ('action_tv', f'{BASE} AND collection:classic_tv AND (subject:(action) OR title:(baywatch) OR title:(walker) OR title:(rescue) OR title:(highlander) OR title:(lightning force) OR title:(vr-5) OR title:(crime traveller))', 120),
    ('cop', f'{BASE} AND collection:classic_tv AND (subject:(police) OR title:(cop) OR title:(detective) OR title:(shades of l.a.))', 120),
    ('medical', f'{BASE} AND collection:classic_tv AND (subject:(medical) OR title:(hospital) OR title:(doctor) OR title:(doogie))', 100),
    ('teen', f'{BASE} AND collection:classic_tv AND (subject:(teen) OR title:(teen) OR title:(high school))', 100),
    ('kids_tv', f'{BASE} AND collection:classic_tv AND (subject:(children) OR subject:(kids) OR title:(kids) OR title:(honey i shrunk))', 120),
    ('family_tv', f'{BASE} AND collection:classic_tv AND (subject:(family) OR title:(family))', 100),
    ('gameshow', f'{BASE} AND (subject:(game show) OR title:(game show) OR title:(jeopardy) OR title:(wheel of fortune) OR title:(family feud) OR title:(price is right) OR title:(gamepro))', 120),
    ('talk', f'{BASE} AND (subject:(talk show) OR title:(talk show) OR title:(oprah) OR title:(donahue) OR title:(jerry springer) OR title:(maury))', 120),
    ('court', f'{BASE} AND (subject:(court) OR title:(court) OR title:(judge) OR title:(trial) OR title:(verdict))', 120),
    ('news', f'{BASE} AND collection:tvnews AND (title:(news) OR subject:(news))', 160),
    ('documentary', f'{BASE} AND (subject:(documentary) OR title:(documentary) OR title:(national geographic) OR title:(nova) OR title:(history))', 160),
    ('nature', f'{BASE} AND (subject:(nature) OR title:(nature) OR title:(wildlife) OR title:(planet earth) OR title:(national geographic))', 140),
    ('science', f'{BASE} AND (subject:(science) OR title:(science) OR title:(nova) OR title:(national geographic) OR title:(bill nye))', 140),
    ('history', f'{BASE} AND (subject:(history) OR title:(history) OR title:(oral history) OR title:(civilization) OR title:(ancient))', 140),
    ('truecrime', f'{BASE} AND (subject:(true crime) OR title:(crime) OR title:(murder) OR title:(forensic) OR title:(investigation))', 140),
    ('truecrime2', f'{BASE} AND (title:(Waco) OR title:(cold case) OR title:(hate crime) OR title:(crime in the city))', 80),
    ('truecrime3', f'{BASE} AND (title:(Marilyn Monroe) OR title:(Anatomy of Crime))', 40),
    ('music', f'{BASE} AND (subject:(concert) OR title:(concert) OR title:(live at) OR subject:(music performance) OR title:(music video) OR title:(rock music) OR title:(pop music))', 160),
    ('standup', f'{BASE} AND (subject:(stand-up comedy) OR title:(stand-up) OR title:(stand up) OR title:(comedy special))', 120),
    ('sports', f'{BASE} AND collection:sports AND (title:(hockey) OR title:(football) OR title:(baseball) OR title:(basketball) OR title:(game) OR title:(tournament) OR title:(boxing) OR title:(racing))', 140),
    ('wrestling', f'{BASE} AND (title:(wwf) OR title:(wcw) OR title:(ecw) OR title:(wrestling) OR title:(roh) OR title:(shimmer) OR subject:(professional wrestling))', 160),
    ('mov_action', f'{BASE} AND collection:feature_films AND (subject:(action) OR title:(action))', 120),
    ('mov_comedy', f'{BASE} AND collection:feature_films AND (subject:(comedy) OR title:(comedy))', 120),
    ('mov_horror', f'{BASE} AND collection:feature_films AND (subject:(horror) OR title:(horror))', 120),
    ('mov_thriller', f'{BASE} AND collection:feature_films AND (subject:(thriller) OR subject:(crime) OR title:(thriller) OR title:(crime))', 140),
    ('mov_crime', f'{BASE} AND collection:feature_films AND subject:(crime)', 140),
    ('mov_scifi', f'{BASE} AND collection:feature_films AND (subject:(science fiction) OR subject:(sci-fi))', 140),
    ('mov_drama', f'{BASE} AND collection:feature_films AND (subject:(drama) OR title:(drama))', 140),
]

def get_json(url, timeout=30):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def search(query, rows):
    u = ('https://archive.org/advancedsearch.php?q=' + urllib.parse.quote(query) +
         '&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&rows=' + str(rows) + '&output=json')
    try:
        return get_json(u)['response']['docs']
    except Exception as e:
        print('search failed:', e, flush=True)
        return []

def fetch_meta(doc):
    ident = doc['identifier']
    if ident in cache:
        return ident, cache[ident]
    try:
        m = get_json('https://archive.org/metadata/' + urllib.parse.quote(ident), timeout=35)
    except Exception as e:
        m = {'error': str(e)}
    cache[ident] = m
    return ident, m

print('searching archive...', flush=True)
doc_sources = {}
all_docs = {}
for source, query, rows in QUERIES:
    docs = search(query, rows)
    for d in docs:
        ident = d['identifier']
        all_docs[ident] = d
        doc_sources.setdefault(ident, set()).add(source)
    print(f'  {source}: {len(docs)}', flush=True)
print('unique docs', len(all_docs), flush=True)

metas = {}
with concurrent.futures.ThreadPoolExecutor(max_workers=24) as ex:
    futs = {ex.submit(fetch_meta, d): d for d in all_docs.values()}
    done = 0
    for fut in concurrent.futures.as_completed(futs):
        ident, meta = fut.result()
        metas[ident] = meta
        done += 1
        if done % 150 == 0:
            print('metadata', done, '/', len(all_docs), flush=True)
json.dump(cache, open(CACHE, 'w'))

BLOCK = re.compile(r'funny or die|gameplay|playthrough|walkthrough|let.?s play|tutorial|\blesson\b|counter.?strike|machinima|minecraft|world of warcraft|\bsims\b|blender|infomercial|commercial|\btrailer\b|\bteaser\b|\bpromo\b|\bclips?\b|segment|slideshow|\bslides\b|\bhighlights?\b|\bpartial\b|supplementary|\bbonus\b|\bbroll\b|behind the scenes|press conference|campaign|political|sermon|church|worship|bible|cspan|congress|senate|\bhearing\b|subcommittee|house of representatives|city council|school board', re.I)
MACHINIMA = re.compile(r'machinima', re.I)
OLD_TITLE_YEAR = re.compile(r'\((?:18\d{2}|19[0-8]\d)\)')
OLD_YEAR_ANY = re.compile(r'\b(?:18\d{2}|19[0-8]\d)\b')

def clean_title(t):
    s = str(t or '').replace('_', ' ').replace('\n', ' ')
    s = re.sub(r'\s+', ' ', s).strip()
    if not re.match(r'^(19|20)\d\d\b', s):
        s = re.sub(r'^\d{3,5}\s+', '', s)
    s = re.sub(r'\b([A-Z][a-z]{2,8})\s+(\d{1,2})(\d{4})\b', r'\1 \2, \3', s)
    return s

def first(v):
    if isinstance(v, list): return v[0] if v else ''
    return v

items = []
seen_items = set()
for ident, d in all_docs.items():
    meta = metas.get(ident) or {}
    if meta.get('error'):
        continue
    md = meta.get('metadata', {})
    title = clean_title(first(md.get('title')) or d.get('title') or ident)
    if OLD_TITLE_YEAR.search(title) or OLD_YEAR_ANY.search(title):
        continue
    year = str(first(md.get('year')) or d.get('year') or '')
    try:
        y = int(year[:4])
    except Exception:
        continue
    if not (1990 <= y <= 2009):
        continue
    collections = md.get('collection') or []
    if isinstance(collections, str): collections = [collections]
    coll_text = ' '.join(str(x) for x in collections)
    subject = md.get('subject') or ''
    if isinstance(subject, list): subject = ' '.join(str(x) for x in subject)
    subject = str(subject)
    hay = title + ' ' + ident + ' ' + subject + ' ' + coll_text
    if BLOCK.search(hay):
        continue
    if MACHINIMA.search(coll_text) and 'cartoon' in doc_sources[ident]:
        continue
    for f in meta.get('files', []):
        name = f.get('name', '')
        low = name.lower()
        if not low.endswith('.mp4'): continue
        if f.get('private') is True: continue
        if BLOCK.search(low): continue
        try:
            dur = float(f.get('length') or 0)
        except Exception:
            dur = 0
        if dur < 600: continue
        key = (ident, name)
        if key in seen_items: continue
        seen_items.add(key)
        items.append({
            'id': ident, 'file': name, 'duration': round(dur, 3),
            'title': title, 'year': y, 'subject': subject[:500],
            'sources': sorted(doc_sources[ident])
        })

print('pool items', len(items), flush=True)

CARTOON_OK = re.compile(r'cartoon|toon|animated|mr\.? bean|re-?animated|killer tomatoes|barnyard commandos|gravedale high|\bcro[- ]|family dog|battletech|creepy crawlers|gargoyles|superfriends|aquaman|batman|hulk hogan|superboy|wonder toons|usa cartoon express|\btick\b|transformers|samurai pizza cats', re.I)
CARTOON_BAD = re.compile(r'battlebots|ebert|roeper|catalog|screener', re.I)
ANIME_OK = re.compile(r'samurai pizza cats|transformers|dragon ball|dragon warrior|evangelion|patlabor|mew mew|cybersix|dinozaurs|galaxy police|animal crossing|story of fifteen boys|gundam|sailor moon|tenchi|robotech|macross|voltron|pok[eé]mon|digimon|yu-?gi-?oh|inuyasha|naruto|bleach|cardcaptor|astro boy|speed racer|akira|ghost in the shell|ninja scroll|vampire hunter d|fullmetal|trigun|cowboy bebop|outlaw star|escaflowne|slayers|ranma|lupin|detective conan|case closed|one piece|shaman king|medabots|beyblade|monster rancher|battle of the planets|star blazers|gatchaman|tekken|final fantasy', re.I)
ANIME_BAD = re.compile(r'catalog|screener|history|autism|advocates|convention|panel|interview|documentary|mythology|commercial|trailer|promo|music video|bento beatbox|preview|release|review|incomplete|sudoStef|reupload|youtube|\bsubs?\b|subtitled|\braw\b', re.I)
SITCOM_OK = re.compile(r'sitcom|hi honey|maggie winters|\bpayne\b|mr\.? rhodes|ned and stacey|work with me|south central|704 hauser|chris cross|shasta mcnasty|top of the heap|\bsibs\b|princesses|rhythm & blues|good advice|minor adjustments', re.I)
SITCOM_BAD = re.compile(r'pilot eps|viewing room|youtuber|steven banks|family dog|an american family|club connect|chicken soup|review', re.I)
SOAP_OK = re.compile(r'coronation street|emmerdale|days of our lives|bold and the beautiful|general hospital|home and away|models inc|swans crossing|soap', re.I)
SOAP_BAD = re.compile(r'funny or die', re.I)
DRAMA_OK = re.compile(r'drama|scene of the crime|shades of l\.a\.|moon over miami|due south|northwood|pie in the sky|safe harbor|chicken soup for the soul|vengeance unlimited', re.I)
DRAMA_BAD = re.compile(r'documentary|\bplay\b|anatomy of crime|ebert|roeper|behind the scenes|suddenly susan|clueless', re.I)
SCIFI_OK = re.compile(r'star trek|farscape|quantum leap|babylon 5|stargate|sliders|outer limits|battlestar|x-files|twilight zone|perversions of science|now and again|nowhere man|science fiction|sci-?fi', re.I)
ACTION_OK = re.compile(r'rescue 77|she wolf|vr-5|crime traveller|lightning force|\blegend\b|mission genesis|generation x|baywatch|walker|highlander|shades of l\.a\.|pie in the sky', re.I)
ACTION_BAD = re.compile(r'\bplay\b|documentary', re.I)
MEDICAL_OK = re.compile(r'doogie|howser|hospital|doctor|\bcoma\b|medical', re.I)
TEEN_OK = re.compile(r'teen|hull high|swans crossing|high school|club connect|northwood', re.I)
KIDS_OK = re.compile(r'kids|children|honey i shrunk|sea-?monkeys|amazing live sea|chicken soup for the soul|\btick\b|fox kids', re.I)
KIDS_BAD = re.compile(r'what.?s killing|clinton|president|concert|research|feud|news', re.I)
FAMILY_OK = re.compile(r'family|christmas|mighty kong|little spirit|wonderland|raise your voice|jonathan sperry|countess alice|sea-?monkeys|704 hauser|chris cross|chicken soup', re.I)
FAMILY_BAD = re.compile(r'club connect|feud|research|game show|news|horror|thriller|dead|curse|murder', re.I)
GAMESHOW_OK = re.compile(r'family feud|gamepro|combination lock|jeopardy|wheel of fortune|price is right|university challenge|school olympiad|game show|quiz show', re.I)
GAMESHOW_BAD = re.compile(r'funny or die|pilot eps|viewing room|crumie|arthur|compilation|dvd\+r|g4tv|tokyo game show|video game', re.I)
TALK_OK = re.compile(r'donahue|oprah|springer|maury|monday night live|taking back the village|talk show', re.I)
TALK_BAD = re.compile(r'awards|music|concert|news|comedy special', re.I)
NEWS_OK = re.compile(r'news|newscast|newsbreak|news break|sunrise|prime news|o.?reilly factor|morning', re.I)
DOC_OK = re.compile(r'documentary|national geographic|\bnova\b|in the face of evil|george martin in my life|comedian|swimming with whales|extraterrestrial', re.I)
DOC_BAD = re.compile(r'street theater|independent media center|world trade|behind the scenes|deleted scenes|funny or die', re.I)
NATURE_OK = re.compile(r'wildlife|\bnature\b|national geographic|bbc nature|blue planet|world of wildlife|planet earth|extraterrestrial|crater lions|maui daily|skeleton coast|raptor force|oceanography|sea trek|discover russia|natural wonders|secret animal|dino - majestic peace', re.I)
NATURE_BAD = re.compile(r'heaven.?s gate|evacuate|recycled|occult|inspirational|political|ancient wisdom|subcommittee|fisheries|worship|church|enemies we face|plato|phaedrus|philosophy|lecture|symposium|naughty by nature|dance party|folk art|hackers|hope-1|legal issues|national id|human nature|nature made|yokohama|workout|exercise|fitness|denise austin|\banime\b|\bova\b', re.I)
SCIENCE_OK = re.compile(r'\bnova\b|national geographic|bill nye|blue planet|universe|planet|synthetic life|science guy|earth.?s seasons|wildlife|attenborough|nature|ocean|animal|dinosaur|lions', re.I)
SCIENCE_BAD = re.compile(r'microsoft research|caf[eé] science|lecture|keynote|panel|conference|symposium|craig venter|juan enriquez|street theater|independent media center|world trade|heaven.?s gate|evacuate|recycled|occult|inspirational|political|ancient wisdom|subcommittee|fisheries|worship|church|enemies we face', re.I)
HISTORY_OK = re.compile(r'history|oral history|ancient|civilization|times past|lewis & clark|veterans|story share|liberty|blockhouse|hamilton-wenham', re.I)
HISTORY_BAD = re.compile(r'apple history|audio format|fetish|political|recruiting|parade|\bfair\b|home movie|birthday|school play', re.I)
TRUECRIME_OK = re.compile(r'waco investigation|marilyn monroe.*investigation|anatomy of a hate crime|cold case murder|misha glenny|crime in the city|anatomy of crime', re.I)
TRUECRIME_BAD = re.compile(r'players present|\bplay\b|theatre|theater|scifi shows|ebert|roeper|review|comedy|behind the scenes|hud investigation|martha speaks|life on the murder scene|black donnellys|faith-based|numismatic|murder set pieces|aerosol|financial investigation|microsoft research|accident investigation|senior crime|hated|xpw|galaxy police', re.I)
THRILLER_BAD = re.compile(r'christmas in wonderland|area 51|comedy|family|animation', re.I)
CRIME_BAD = re.compile(r'comedy|family|horror|science.?fiction|sci-?fi|fantasy|animation|christmas|romance', re.I)
SCIFI_MOVIE_BAD = re.compile(r'complete series|season|episodes|tv series|miniseries|documentary|fan film|comedy', re.I)
COURT_OK = re.compile(r'\bcourt\b|judge|trial|verdict|justice|people.?s exhibit|lawsuit|murder', re.I)
COURT_BAD = re.compile(r'eagle court|supreme court|senate|house|hearing|subcommittee|political|nomination|confirmation', re.I)
MUSIC_VIDEO_OK = re.compile(r'music video|video magazine|rock|pop|band|mtv|springsteen|dashboard|alkaline|bond\b|steps\b|mke|morris brothers|appex|classified', re.I)
MUSIC_BAD = re.compile(r'inspirational|christmas|church|worship|gospel|religious|barney|little kids|school|high school|middle school|choir|honey i shrunk', re.I)
LIVE_MUSIC_OK = re.compile(r'concert|live at|live in|in concert|performance|festival|tour|steps|appex|morris brothers|mke|springsteen|dashboard|alkaline|bond\b', re.I)
STANDUP_OK = re.compile(r'stand-?up|stand up|george lopez|jim carrey|jim jefferies|pulp comics|breuer|laughing out loud|sunday comics|comedy special|the man who thinks he.?s it|latter day night', re.I)
STANDUP_BAD = re.compile(r'ace ventura|generation x|some prefer cake|nature calls', re.I)
SPORTS_OK = re.compile(r'hockey|football|baseball|basketball|boxing|racing|tournament|olympiad|sports|pickup', re.I)
SPORTS_BAD = re.compile(r'wrestling|university challenge|pilot eps|viewing room|haggard|puzzle|religious|slideshow|backyard', re.I)
WRESTLING_OK = re.compile(r'wwf|wcw|ecw|\broh\b|shimmer|wrestling|wrestlemania|summerslam|halloween havoc|guilty as charged|born to be wired|heatwave|hardcore|title\b|honor', re.I)
WRESTLING_BAD = re.compile(r'cartoon|superfriends|aquaman|batman|hulk hogan|superboy|usa cartoon express|rock.?n.?wrestling|sea-?monkeys|amazing live|parade|school|gameplay|playstation|sega|dreamcast|\bsims\b|rocket|birthday|vlog|review|fatliners|ohsaa|sports live|girls basketball|cael sanderson|my wife|according to jim|invitational|st\. xavier|finneytown|high school', re.I)

SPECS = [
    ('90s Cartoons', ['cartoon'], (1990,1999), CARTOON_OK, CARTOON_BAD, 600, ['cartoon','toon']),
    ('Saturday Morning Cartoons', ['cartoon'], (1990,2009), CARTOON_OK, CARTOON_BAD, 600, ['cartoon','toon']),
    ('Classic Cartoons', ['cartoon'], (1990,2009), CARTOON_OK, CARTOON_BAD, 600, ['cartoon','toon']),
    ('Animated Action', ['cartoon'], (1990,2009), CARTOON_OK, CARTOON_BAD, 600, ['action','transformers','gargoyles']),
    ('Cartoon Vault', ['cartoon'], (1990,2009), CARTOON_OK, CARTOON_BAD, 600, ['cartoon','toon']),
    ('Anime Classics', ['anime'], (1990,2009), ANIME_OK, ANIME_BAD, 600, ['anime','series']),
    ('90s Anime', ['anime'], (1990,1999), ANIME_OK, ANIME_BAD, 600, ['anime']),
    ('Toonami Anime', ['anime'], (1990,2009), ANIME_OK, ANIME_BAD, 600, ['action','dragon','gundam']),
    ('Anime Theater', ['anime'], (1990,2009), re.compile(r'\bmovie\b|\bfilm\b|fusion reborn|evangelion|spirited away|castle in the sky|princess mononoke|\bakira\b|ghost in the shell|ninja scroll|vampire hunter d|animal crossing|fifteen boys|mihoshi|pikachu|nadesico|afro samurai|inu-?yasha.*movie|wee wendy', re.I), ANIME_BAD, 600, ['anime','movie']),
    ('Anime Vault', ['anime'], (1990,2009), ANIME_OK, ANIME_BAD, 600, ['anime','movie']),
    ('Kids TV', ['kids_tv'], (1990,2009), KIDS_OK, KIDS_BAD, 600, ['kids','children','honey']),
    ('Family TV', ['family_tv'], (1990,2009), FAMILY_OK, FAMILY_BAD, 600, ['family','christmas']),
    ('90s Sitcoms', ['sitcom'], (1990,1999), SITCOM_OK, SITCOM_BAD, 600, ['sitcom','comedy']),
    ('Classic Sitcoms', ['sitcom'], (1990,2009), SITCOM_OK, SITCOM_BAD, 600, ['sitcom','comedy']),
    ('Must-See TV', ['sitcom'], (1990,2009), SITCOM_OK, SITCOM_BAD, 600, ['sitcom','comedy']),
    ('TGIF', ['sitcom'], (1990,2009), SITCOM_OK, SITCOM_BAD, 600, ['family','comedy']),
    ('Nick at Nite', ['sitcom'], (1990,2009), SITCOM_OK, SITCOM_BAD, 600, ['classic','comedy']),
    ('Sitcom Vault', ['sitcom'], (1990,2009), SITCOM_OK, SITCOM_BAD, 600, ['sitcom']),
    ('Soap Operas', ['soap'], (1990,2009), SOAP_OK, SOAP_BAD, 600, ['street','emmerdale','days']),
    ('Daytime Soaps', ['soap'], (1990,2009), SOAP_OK, SOAP_BAD, 600, ['street','emmerdale']),
    ('Soap Vault', ['soap'], (1990,2009), SOAP_OK, SOAP_BAD, 600, ['soap']),
    ('90s Dramas', ['drama_tv'], (1990,1999), DRAMA_OK, DRAMA_BAD, 600, ['drama','crime']),
    ('Crime Dramas', ['drama_tv','cop'], (1990,2009), re.compile(r'crime|detective|police|cop|scene of the crime|shades of l|moon over miami|due south|vengeance unlimited|pie in the sky', re.I), DRAMA_BAD, 600, ['crime','detective']),
    ('Drama Vault', ['drama_tv'], (1990,2009), DRAMA_OK, DRAMA_BAD, 600, ['drama']),
    ('Crime Movies', ['mov_crime'], (1990,2009), None, CRIME_BAD, 3000, ['crime','murder']),
    ('Teen TV', ['teen'], (1990,2009), TEEN_OK, None, 600, ['teen','high school']),
    ('Sci-Fi Channel', ['scifi'], (1990,2009), SCIFI_OK, None, 600, ['science fiction','sci-fi']),
    ('90s Sci-Fi', ['scifi'], (1990,1999), SCIFI_OK, None, 600, ['science fiction']),
    ('Sci-Fi Vault', ['scifi'], (1990,2009), SCIFI_OK, None, 600, ['science fiction']),
    ('Star Trek & Beyond', ['scifi'], (1990,2009), re.compile(r'star trek|farscape|quantum leap|babylon 5|stargate|sliders|outer limits|battlestar', re.I), None, 600, ['star trek','farscape']),
    ('90s Action', ['action_tv'], (1990,1999), ACTION_OK, ACTION_BAD, 600, ['action','rescue']),
    ('Action Block', ['action_tv'], (1990,2009), ACTION_OK, ACTION_BAD, 600, ['action','rescue']),
    ('Cop Shows', ['action_tv','cop'], (1990,2009), re.compile(r'shades of l|pie in the sky|crime traveller|cop|police|detective', re.I), ACTION_BAD, 600, ['cop','police']),
    ('Action Vault', ['action_tv'], (1990,2009), ACTION_OK, ACTION_BAD, 600, ['action','rescue']),
    ('Drama Showcase', ['drama_tv'], (1990,2009), DRAMA_OK, DRAMA_BAD, 600, ['drama']),
    ('90s Game Shows', ['gameshow'], (1990,1999), GAMESHOW_OK, GAMESHOW_BAD, 600, ['game show','feud']),
    ('2000s Game Shows', ['gameshow'], (2000,2009), GAMESHOW_OK, GAMESHOW_BAD, 600, ['game show','feud']),
    ('Game Show Marathon', ['gameshow'], (1990,2009), GAMESHOW_OK, GAMESHOW_BAD, 600, ['game show','feud']),
    ('Talk Shows', ['talk'], (1990,2009), TALK_OK, TALK_BAD, 600, ['talk','show']),
    ('Community Talk', ['talk'], (1990,2009), TALK_OK, TALK_BAD, 600, ['talk','show']),
    ('News & Current Affairs', ['news'], (1990,2009), NEWS_OK, None, 600, ['news','tonight']),
    ('Morning News', ['news'], (1990,2009), re.compile(r'morning|sunrise|today|early', re.I), None, 600, ['morning','news']),
    ('Evening News', ['news'], (1990,2009), re.compile(r'evening|night|prime news|at 5|at 6|at 10|at 11', re.I), None, 600, ['news','evening']),
    ('News Vault', ['news'], (1990,2009), NEWS_OK, None, 600, ['news']),
    ('Documentary Hour', ['documentary'], (1990,2009), DOC_OK, DOC_BAD, 900, ['documentary','history']),
    ('Nature & Wildlife', ['nature'], (1990,2009), NATURE_OK, NATURE_BAD, 900, ['wildlife','nature']),
    ('Science & Discovery', ['nature','science'], (1990,2009), SCIENCE_OK, SCIENCE_BAD, 900, ['science','nova']),
    ('History Vault', ['history'], (1990,2009), HISTORY_OK, HISTORY_BAD, 900, ['history','oral']),
    ('True Crime', ['truecrime','truecrime2','truecrime3'], (1990,2009), TRUECRIME_OK, TRUECRIME_BAD, 900, ['crime','murder']),
    ('Documentary Vault', ['documentary'], (1990,2009), DOC_OK, DOC_BAD, 900, ['documentary','history']),
    ('History & Society', ['history'], (1990,2009), HISTORY_OK, HISTORY_BAD, 900, ['history','oral']),
    ('90s Movies', ['mov_action','mov_comedy','mov_horror','mov_thriller','mov_drama'], (1990,1999), None, None, 3000, ['movie']),
    ('2000s Movies', ['mov_action','mov_comedy','mov_horror','mov_thriller','mov_drama'], (2000,2009), None, None, 3000, ['movie']),
    ('Action Movies', ['mov_action'], (1990,2009), None, None, 3000, ['action']),
    ('Action Movie Vault', ['mov_action'], (1990,2009), None, None, 3000, ['action']),
    ('Comedy Movies', ['mov_comedy'], (1990,2009), None, None, 3000, ['comedy']),
    ('Comedy Vault', ['mov_comedy'], (1990,2009), None, None, 3000, ['comedy']),
    ('Horror Movies', ['mov_horror'], (1990,2009), None, None, 3000, ['horror']),
    ('Late Night Horror', ['mov_horror'], (1990,2009), re.compile(r'zombie|slasher|massacre|evil|dead|midnight|psychotic|curse|scarecrow|night of', re.I), None, 3000, ['horror','dead']),
    ('Thriller Movies', ['mov_thriller'], (1990,2009), None, THRILLER_BAD, 3000, ['thriller','crime']),
    ('Crime Movie Vault', ['mov_crime'], (1990,2009), None, CRIME_BAD, 3000, ['crime','murder']),
    ('Drama Movies', ['mov_drama'], (1990,2009), None, None, 3000, ['drama']),
    ('Drama Movie Vault', ['mov_drama'], (1990,2009), None, None, 3000, ['drama']),
    ('Music Mix', ['music'], (1990,2009), MUSIC_VIDEO_OK, MUSIC_BAD, 600, ['music','video']),
    ('Live Concerts', ['music'], (1990,2009), LIVE_MUSIC_OK, MUSIC_BAD, 900, ['concert','live']),
    ('Comedy Movies 2', ['mov_comedy'], (1990,2009), None, None, 3000, ['comedy']),
    ('Hockey Replays', ['sports'], (1990,2009), SPORTS_OK, SPORTS_BAD, 900, ['hockey','game']),
    ('Hockey Night', ['sports'], (1990,2009), re.compile(r'hockey', re.I), SPORTS_BAD, 900, ['hockey']),
    ('90s Wrestling', ['wrestling'], (1990,1999), WRESTLING_OK, WRESTLING_BAD, 900, ['wrestling','wcw','ecw']),
    ('2000s Wrestling', ['wrestling'], (2000,2009), WRESTLING_OK, WRESTLING_BAD, 900, ['wrestling','wwf','roh']),
]

assert len(SPECS) == 70, len(SPECS)

def score(it, keywords):
    t = it['title'].lower()
    return sum(5 if k.lower() in t else 0 for k in keywords)

# One item per archive identifier: an identifier is a show/broadcast, so it can
# only belong to one channel.
by_id = {}
for it in items:
    prev = by_id.get(it['id'])
    if not prev or it['duration'] > prev['duration']:
        by_id[it['id']] = it
items = list(by_id.values())

# Base genre channels own their items; keep premium from reusing them.
try:
    genre_ids = {it['id'] for c in json.load(open('genres.json')) for it in c['items']}
    items = [it for it in items if it['id'] not in genre_ids]
except FileNotFoundError:
    genre_ids = set()

def title_key(it):
    return re.sub(r'\s+', ' ', it['title'].lower()).strip()

spec_cands = []
for i, (name, sources, years, ok, bad, min_dur, keywords) in enumerate(SPECS):
    cands = []
    for it in items:
        if not (set(sources) & set(it['sources'])):
            continue
        if not (years[0] <= it['year'] <= years[1]):
            continue
        if it['duration'] < min_dur:
            continue
        hay = it['title'] + ' ' + it.get('subject', '')
        if ok and not ok.search(hay):
            continue
        if bad and bad.search(hay):
            continue
        cands.append(it)
    seen = set()
    uniq = []
    for it in sorted(cands, key=lambda x: (-score(x, keywords), x['year'], x['title'])):
        tkey = title_key(it)
        if tkey in seen:
            continue
        seen.add(tkey)
        uniq.append(it)
    spec_cands.append((i, name, uniq))

used_ids = set()
used_titles = set()
assigned = {i: [] for i in range(len(SPECS))}
warnings = []
cands_by_i = {i: cands for i, name, cands in spec_cands}
name_by_i = {i: name for i, name, cands in spec_cands}
order = [i for i, name, cands in sorted(spec_cands, key=lambda x: (len(x[2]), x[0]))]

print('unique pool', len(items), flush=True)
print('candidate counts', sorted(((name, len(cands)) for i, name, cands in spec_cands), key=lambda x: x[1])[:12], flush=True)

# Round-robin allocation: no channel can hoard a shared candidate set, and
# every channel gets a chance at one show before any channel gets a second.
for round_no in range(10):
    target = 7 if round_no < 7 else 10
    for i in order:
        if len(assigned[i]) >= target:
            continue
        for it in cands_by_i[i]:
            if it['id'] in used_ids or title_key(it) in used_titles:
                continue
            assigned[i].append(it)
            used_ids.add(it['id'])
            used_titles.add(title_key(it))
            break

for i in range(len(SPECS)):
    if len(assigned[i]) < 3:
        warnings.append(f'{name_by_i[i]}: only {len(assigned[i])} unique items')

premium = []
for i, (name, sources, years, ok, bad, min_dur, keywords) in enumerate(SPECS):
    picked = assigned.get(i, [])
    items_out = [{'id':x['id'],'file':x['file'],'duration':x['duration'],'title':x['title'],'year':str(x['year'])} for x in picked]
    if not items_out:
        items_out = [{'id':'', 'file':'', 'duration':0, 'title':'No verified content', 'year':''}]
    premium.append({
        'number': 71+i,
        'id': 'premium-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'),
        'name': 'PREMIUM: '+name,
        'category': 'Premium',
        'group': 'premium',
        'premium': True,
        'tier': 'Gold' if i < 35 else 'Platinum',
        'mode': 'playlist',
        'description': 'Full-length 1990s and 2000s programming matched to this channel.',
        'startMs': 1704067200000 + i*97*60000,
        'startIndex': (i*3) % max(1,len(items_out)),
        'items': items_out
    })

with open('premium.js','w') as f:
    f.write('window.PREMIUM_CHANNELS = '+json.dumps(premium, indent=2)+';\n')

print('premium channels', len(premium), 'items total', sum(len(c['items']) for c in premium), flush=True)
for w in warnings: print('WARN', w, flush=True)
print('\n=== CHANNEL AUDIT ===')
for c in premium:
    print(f"\n{c['number']} {c['name']} ({len(c['items'])} items)")
    for it in c['items'][:6]:
        print(f"   {it['year']} {it['duration']:7.1f}s {it['title'][:90]}")
