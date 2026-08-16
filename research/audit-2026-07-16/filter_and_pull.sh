#!/usr/bin/env bash
# Re-filter cached submissions with a STRICT relevance gate (subreddit whitelist
# + CLM phrasing, exclude sports/finance/options/employment noise), then serial
# comment-tree pulls for genuinely-relevant new threads.
set -uo pipefail
OUT="/Users/wassimbensalem/Desktop/Projects-Extra/CLM/research/audit-2026-07-16/reddit-raw"
LOG="$OUT/filter.log"; : > "$LOG"

python3 - "$OUT" >>"$LOG" 2>&1 <<'PY'
import json,glob,re,sys
out=sys.argv[1]
seen=set("19392l3 1huyhwz 1bipens 1abrw89 1ftgspf 1hv84tf 1kpnn06".split())
# Subreddits where a CLM/contract-management ask is plausibly on-topic
WL={'selfhosted','opensource','degoogle','privacy','sysadmin','msp','procurement',
    'legaltech','legaloperations','legaladvice','smallbusiness','Entrepreneur',
    'entrepreneur','ExperiencedDevs','nonprofit','consulting','freelance','DataHoarder',
    'business','SaaS','saas','ITManagers','sales','sysadministrator','sysadmjobs',
    'ecommerce','startups','indiehackers','webdev','opensourcesoftware','Business',
    'smallbusinessuk','AskProgramming','Contracts','sysadminjobs','k12sysadmin',
    'realtors','commercialrealestate','property','construction','Construction'}
# Must look like software/tooling for MANAGING contracts (not sports/options/legal-dispute)
POS=re.compile(r'(contract|clm)\b.*\b(manage|management|managing|track|tracker|tracking|'
               r'lifecycle|repository|renewal|expiration|expiry|software|tool|system|'
               r'platform|self.?host|open.?source|reminder|database|organize)', re.I)
POS2=re.compile(r'(manage|track|tracking|self.?host|open.?source|software|tool|system|repository)'
                r'.*\bcontract', re.I)
NEG=re.compile(r'\b(nba|nfl|nhl|mlb|fifa|soccer|trade|traded|options?\b|0dte|calls?\b|puts?\b|'
               r'wallstreet|stonk|smart contract|blockchain|crypto|solidity|employment law|'
               r'non-?compete|fired|layoff|salary negotiat|record label|free agent|draft pick)', re.I)
rows={}
for f in glob.glob(out+'/submissions/term_*.json'):
    try: data=json.load(open(f))['data']
    except: continue
    for d in data:
        idd=d.get('id'); sub=(d.get('subreddit') or '')
        if not idd or idd in seen: continue
        text=(d.get('title','')+' '+(d.get('selftext') or ''))
        if NEG.search(text): continue
        on_sub = sub in WL
        on_phrase = bool(POS.search(text) or POS2.search(text))
        # keep if (whitelisted sub AND mentions contract-management-ish) OR (strong phrase anywhere)
        if not ((on_sub and re.search(r'contract|clm', text, re.I)) or on_phrase):
            continue
        rows[idd]={'id':idd,'sub':sub,'title':d.get('title'),'score':d.get('score',0),
                   'num_comments':d.get('num_comments',0),'created':d.get('created_utc'),
                   'permalink':d.get('permalink'),'selftext':(d.get('selftext') or '')[:800],
                   'on_sub':on_sub}
rel=sorted(rows.values(), key=lambda r:(r['on_sub'], r['num_comments'], r['score']), reverse=True)
json.dump(rel, open(out+'/relevant_submissions.json','w'), indent=1)
print(f"STRICT relevant unique submissions: {len(rel)}")
for r in rel[:60]:
    print(f"  [{r['num_comments']}c {r['score']}p] r/{r['sub']} {r['id']} {r['title'][:85]}")
PY

echo "" >>"$LOG"; echo "=== comment pulls (relevant, >=3c, cap 45 threads) ===" >>"$LOG"
fetch(){ local url="$1" out="$2" t=0 code; while :; do
  code=$(curl -s "$url" -o "$out" -w "%{http_code}");
  [ "$code" = "200" ] && return 0
  [ "$code" = "429" ] && { t=$((t+1)); [ $t -gt 4 ] && return 1; sleep $((t*20)); continue; }
  echo "HTTP $code $url" >>"$LOG"; return 1; done; }

python3 -c "import json;[print(r['id']) for r in json.load(open('$OUT/relevant_submissions.json')) if r['num_comments']>=3][:45]" | while read -r lid; do
  [ -z "$lid" ] && continue
  [ -f "$OUT/comments/${lid}.json" ] && { echo "skip cached ${lid}" >>"$LOG"; continue; }
  fetch "https://api.pullpush.io/reddit/search/comment/?link_id=${lid}&size=100" "$OUT/comments/${lid}.json"
  c=$(python3 -c "import json;print(len(json.load(open('$OUT/comments/${lid}.json'))['data']))" 2>/dev/null || echo 0)
  echo "thread ${lid} -> ${c} comments" >>"$LOG"; sleep 4
done
echo "=== DONE $(date) ===" >>"$LOG"
PY_DONE=1
