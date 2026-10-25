import urllib.request, urllib.parse, json, concurrent.futures, re, sys, os, time

CACHE = '/tmp/opencode/meta_cache.json'
cache = {}
if os.path.exists(CACHE):
    try: cache = json.load(open(CACHE))
    except: cache = {}

def get_json(url, timeout=25):
    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def search(query, rows):
    u = f'https://archive.org/advancedsearch.php?q={urllib.parse.quote(query)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=language&rows={rows}&output=json'
    d = get_json(u)
    return d['response']['docs']

def fetch_meta(doc):
    ident = doc['identifier']
    if ident in cache:
        return cache[ident]
    try:
        m = get_json('https://archive.org/metadata/' + urllib.parse.quote(ident), timeout=30)
    except Exception as e:
        m = {'error': str(e)}
    cache[ident] = m
    return m

print('searching archive...', flush=True)
docs = []
docs += search('collection:classic_tv AND year:[1990 TO 2009] AND language:(eng OR English) AND mediatype:movies', 220)
docs += search('collection:feature_films AND year:[1990 TO 2009] AND language:(eng OR English) AND mediatype:movies', 90)
# dedupe
seen=set(); uniq=[]
for d in docs:
    if d['identifier'] not in seen:
        seen.add(d['identifier']); uniq.append(d)
docs=uniq
print('candidates', len(docs), flush=True)

def valid_files(ident, meta):
    out=[]
    for f in meta.get('files', []):
        name=f.get('name','')
        if not name.lower().endswith('.mp4'): continue
        if f.get('private') is True: continue
        try: dur=float(f.get('length') or 0)
        except: dur=0
        if dur < 600: continue
        low=name.lower()
        if any(x in low for x in ['segment','commercial','promo','trailer','clip','teaser','bumper']): continue
        out.append({'id':ident,'file':name,'duration':round(dur,3)})
    return out

# fetch metas concurrently
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
    futs={ex.submit(fetch_meta,d):d for d in docs}
    done=0
    for fut in concurrent.futures.as_completed(futs):
        d=futs[fut]; meta=fut.result(); done+=1
        if done%25==0: print('metadata',done,'/',len(docs),flush=True)
        if not meta or meta.get('error'): continue
        md=meta.get('metadata',{})
        title=md.get('title')
        if isinstance(title,list): title=title[0] if title else ''
        title=str(title or d.get('title') or d['identifier'])
        year=md.get('year')
        if isinstance(year,list): year=year[0] if year else ''
        files=valid_files(d['identifier'], meta)
        # cap files per item for variety
        files=files[:3]
        for f in files:
            f['title']=title
            f['year']=str(year or d.get('year') or '')
            results.append(f)

json.dump(cache, open(CACHE,'w'))
print('pool files', len(results), flush=True)

# ensure movies get more weight
if len(results) < 200:
    print('pool small', len(results), flush=True)

def score(item, keywords):
    t=(item['title']+' '+item.get('year','')).lower()
    return sum(3 if k in t else 0 for k in keywords)

templates = [
 ("90s Cartoons", ['cartoon','animation','animated','toon','duckman','moxy','sushi'], "Full 1990s cartoon blocks and episodes."),
 ("2000s Cartoons", ['cartoon','animation','animated','toon','home movies'], "Full 2000s cartoon blocks and episodes."),
 ("Saturday Morning Gold", ['saturday','kids','cartoon','toon','fox kids','kids wb'], "Vintage Saturday-morning cartoon blocks."),
 ("Toonami Classics", ['toonami','anime','action','dragon','gundam','sailor'], "Action animation and Toonami-era blocks."),
 ("Adult Swim After Dark", ['adult swim','duckman','home movies','comedy','late'], "Late-night animated comedy."),
 ("Nick at Nite", ['nick','sitcom','classic','tv'], "Classic sitcoms and retro Nick-style blocks."),
 ("Cartoon Network Classics", ['cartoon network','cartoon','toon','sushi','moxy'], "Cartoon Network-era full blocks."),
 ("Disney Channel Gold", ['disney','family','kids','teen'], "Disney-style family and teen programming."),
 ("Fox Kids", ['fox kids','kids','cartoon','action'], "Fox Kids-era animation and action."),
 ("Kids WB", ['kids wb','wb','kids','cartoon'], "Kids WB-era cartoon blocks."),
 ("One Saturday Morning", ['saturday','morning','kids','disney','abc'], "ABC Saturday-morning blocks."),
 ("90s Sitcoms", ['sitcom','comedy','friends','seinfeld','frasier','drew','newsradio','love'], "Full 1990s sitcom episodes."),
 ("2000s Sitcoms", ['sitcom','comedy','scrubs','office','arrested','2000'], "Full 2000s sitcom episodes."),
 ("Must-See TV", ['nbc','must see','sitcom','friends','frasier','seinfeld'], "Thursday-night sitcom blocks."),
 ("TGIF", ['tgif','family','sitcom','abc','full house','step'], "TGIF-style family sitcoms."),
 ("90s Dramas", ['drama','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999'], "Full 1990s drama episodes."),
 ("2000s Dramas", ['drama','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009'], "Full 2000s drama episodes."),
 ("Prime Time Soaps", ['soap','drama','melrose','90210','knots','dallas'], "Prime-time serial drama."),
 ("Teen Dramas", ['teen','high','school','degrassi','dawson','buffy'], "Teen drama and coming-of-age series."),
 ("90s Action", ['action','rescue','manhunter','lightning','force'], "1990s action series and blocks."),
 ("2000s Action", ['action','24','alias','smallville','2000'], "2000s action series and blocks."),
 ("Cop Shows", ['cop','police','detective','rescue','manhunter','nash'], "Cop and detective series."),
 ("Legal Dramas", ['law','legal','court','judge','order'], "Legal dramas and courtroom series."),
 ("Medical Dramas", ['medical','hospital','er','doctor','rescue'], "Medical dramas and hospital series."),
 ("Sci-Fi Channel", ['sci-fi','scifi','science','space','star','trek','outer'], "Science fiction series and blocks."),
 ("90s Sci-Fi", ['sci-fi','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999'], "1990s science fiction."),
 ("2000s Sci-Fi", ['sci-fi','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009'], "2000s science fiction."),
 ("X-Files Files", ['x-files','x files','mulder','scully','alien'], "Paranormal and conspiracy series."),
 ("Buffyverse", ['buffy','angel','vampire','slayer'], "Buffy and Angel-era supernatural drama."),
 ("Star Trek Marathon", ['star trek','trek','enterprise','voyager','deep space'], "Star Trek series and blocks."),
 ("Anime Classics", ['anime','animation','japan','dragon','gundam','sailor','tenchi'], "Classic anime series and films."),
 ("90s Anime", ['anime','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999'], "1990s anime."),
 ("2000s Anime", ['anime','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009'], "2000s anime."),
 ("Toonami Anime", ['toonami','anime','dragon','gundam','sailor','action'], "Toonami-era anime blocks."),
 ("Saturday Anime", ['anime','saturday','japan','film'], "Saturday anime features."),
 ("Mecha Hour", ['mecha','gundam','robot','evangelion','macross'], "Mecha anime and robot action."),
 ("Magical Girls", ['sailor','magical','girl','moon','cardcaptor'], "Magical-girl anime."),
 ("90s Movies", ['movie','film','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999'], "Full 1990s movies."),
 ("2000s Movies", ['movie','film','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009'], "Full 2000s movies."),
 ("Action Movies", ['action','war','fight','hero','cop'], "Action and adventure movies."),
 ("Comedy Movies", ['comedy','funny','laugh','romantic comedy'], "Comedy movies."),
 ("Horror Movies", ['horror','scary','ghost','monster','evil'], "Horror movies."),
 ("Sci-Fi Movies", ['sci-fi','science','space','alien','future'], "Science-fiction movies."),
 ("Thriller Movies", ['thriller','crime','mystery','suspense'], "Thrillers and crime movies."),
 ("Romance Movies", ['romance','love','wedding','heart'], "Romance movies."),
 ("Drama Movies", ['drama','life','story','family'], "Drama movies."),
 ("Family Movies", ['family','kids','children','adventure'], "Family movies."),
 ("Indie Films", ['indie','independent','festival','short'], "Independent and festival films."),
 ("Cult Classics", ['cult','classic','midnight','weird','bizarre'], "Cult and midnight movies."),
 ("Late Night Movies", ['late','midnight','night','after dark'], "Late-night movie blocks."),
 ("90s Game Shows", ['game show','quiz','prize','wheel','jeopardy','family feud'], "1990s game shows."),
 ("2000s Game Shows", ['game show','quiz','prize','reality','2000'], "2000s game shows."),
 ("Reality TV", ['reality','real world','survivor','big brother','mtv'], "Reality television."),
 ("Talk Shows", ['talk','show','interview','guest','host'], "Talk shows and interviews."),
 ("Music Videos", ['music','video','mtv','vh1','band','concert'], "Music videos and performances."),
 ("MTV Classics", ['mtv','music','video','beavis','butt','real world'], "MTV-era music and reality."),
 ("VH1 Classics", ['vh1','music','behind','story','video'], "VH1-era music programming."),
 ("Behind the Music", ['behind the music','music','story','band'], "Music documentaries and profiles."),
 ("Stand-Up Comedy", ['stand-up','standup','comedy','comic','laugh'], "Stand-up comedy specials."),
 ("Sketch Comedy", ['sketch','comedy','funny','variety'], "Sketch comedy and variety."),
 ("Improv & Variety", ['improv','variety','show','comedy','talent'], "Improv, variety and talent shows."),
 ("Soap Operas", ['soap','opera','drama','days','young','bold'], "Daytime soap operas."),
 ("Daytime TV", ['daytime','morning','show','talk','news'], "Daytime talk and lifestyle."),
 ("Court Shows", ['court','judge','trial','law','order'], "Courtroom and judge shows."),
 ("News & Current Affairs", ['news','tonight','world','report','cbs','nbc','abc'], "News and current-affairs blocks."),
 ("Retro News", ['news','1990','1991','1992','1993','1994','1995','1996','1997','1998','1999','2000'], "Retro news broadcasts."),
 ("Documentary Hour", ['documentary','doc','history','nature','science'], "Documentaries and long-form nonfiction."),
 ("True Crime", ['crime','murder','investigation','detective','forensic'], "True-crime and investigation."),
 ("Nature & Science", ['nature','science','wild','ocean','earth','planet'], "Nature and science programming."),
 ("Premium Gold", ['classic','award','great','best','special'], "The best of the premium vault."),
]

assert len(templates) == 70, len(templates)

premium=[]
for i,(name,keywords,desc) in enumerate(templates):
    scored=sorted(results, key=lambda it: (-score(it,keywords), it['title']))
    picked=[]
    seen_ids=set()
    for it in scored:
        key=(it['id'],it['file'])
        if key in seen_ids: continue
        if score(it,keywords)==0 and len(picked)>=6: break
        picked.append(it); seen_ids.add(key)
        if len(picked)>=10: break
    if len(picked)<6:
        for j in range(len(results)):
            it=results[(i*11+j)%len(results)]
            key=(it['id'],it['file'])
            if key in seen_ids: continue
            picked.append(it); seen_ids.add(key)
            if len(picked)>=8: break
    items=[{'id':x['id'],'file':x['file'],'duration':x['duration'],'title':x['title'],'year':x.get('year','')} for x in picked]
    premium.append({
        'number': 71+i,
        'id': 'premium-'+re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'),
        'name': 'PREMIUM: '+name,
        'category': 'Premium',
        'group': 'premium',
        'premium': True,
        'tier': 'Gold' if i<35 else 'Platinum',
        'mode': 'playlist',
        'description': desc,
        'startMs': 1704067200000 + i*97*60000,
        'startIndex': (i*3) % max(1,len(items)),
        'items': items
    })

with open('premium.js','w') as f:
    f.write('window.PREMIUM_CHANNELS = '+json.dumps(premium, indent=2)+';\n')
print('premium channels', len(premium), 'items total', sum(len(c['items']) for c in premium), flush=True)
