#!/usr/bin/env bash
# Subreddit-SCOPED sweep: search "contract" within each target sub (no global-score
# burial). Serial + 429 backoff. Then serial comment pulls for relevant threads.
set -uo pipefail
OUT="/Users/wassimbensalem/Desktop/Projects-Extra/CLM/research/audit-2026-07-16/reddit-raw"
mkdir -p "$OUT/subscoped"
LOG="$OUT/subscoped.log"; : > "$LOG"

SUBS=(selfhosted opensource degoogle privacy sysadmin msp procurement legaltech \
      legaloperations smallbusiness Entrepreneur nonprofit consulting freelance \
      DataHoarder SaaS ITManagers startups sales ecommerce indiehackers webdev \
      k12sysadmin construction commercialrealestate realtors business)
QS=("contract" "CLM")

fetch(){ local url="$1" out="$2" t=0 code; while :; do
  code=$(curl -s "$url" -o "$out" -w "%{http_code}")
  [ "$code" = "200" ] && return 0
  [ "$code" = "429" ] && { t=$((t+1)); [ $t -gt 5 ] && { echo "GIVEUP $url">>"$LOG"; return 1; }; sleep $((t*15)); continue; }
  echo "HTTP $code $url">>"$LOG"; return 1; done; }

echo "=== subreddit-scoped sweep $(date) ===">>"$LOG"
for sub in "${SUBS[@]}"; do
  for q in "${QS[@]}"; do
    fetch "https://api.pullpush.io/reddit/search/submission/?subreddit=${sub}&q=${q}&size=100&sort=desc&sort_type=score" "$OUT/subscoped/${sub}_${q}.json"
    n=$(python3 -c "import json;print(len(json.load(open('$OUT/subscoped/${sub}_${q}.json'))['data']))" 2>/dev/null || echo 0)
    echo "r/${sub} q=${q} -> ${n}">>"$LOG"; sleep 3
  done
done

# Aggregate + strict CLM relevance filter, dedup vs prior + across this set
python3 - "$OUT" >>"$LOG" 2>&1 <<'PY'
import json,glob,re,sys
out=sys.argv[1]
seen=set("19392l3 1huyhwz 1bipens 1abrw89 1ftgspf 1hv84tf 1kpnn06".split())
CLM=re.compile(r'contract\s*(manage|management|managing|lifecycle|track|tracker|tracking|'
               r'repository|renewal|expir|software|tool|system|platform|database|reminder|organi[sz])'
               r'|\bCLM\b|manage\w*\s+contracts?|track\w*\s+contracts?|'
               r'(self.?host|open.?source)\w*.{0,20}contract|contract.{0,20}(self.?host|open.?source)',re.I)
NEG=re.compile(r'smart contract|blockchain|solidity|\bnft\b|non-?compete|free agent|draft pick|0dte',re.I)
rows={}
for f in glob.glob(out+'/subscoped/*.json'):
    try: data=json.load(open(f))['data']
    except: continue
    for d in data:
        idd=d.get('id')
        if not idd or idd in seen: continue
        text=d.get('title','')+' '+(d.get('selftext') or '')
        if NEG.search(text): continue
        if not CLM.search(text): continue
        rows[idd]={'id':idd,'sub':d.get('subreddit'),'title':d.get('title'),
                   'score':d.get('score',0),'num_comments':d.get('num_comments',0),
                   'created':d.get('created_utc'),'permalink':d.get('permalink'),
                   'selftext':(d.get('selftext') or '')[:600]}
rel=sorted(rows.values(),key=lambda r:(r['num_comments'],r['score']),reverse=True)
json.dump(rel,open(out+'/subscoped_relevant.json','w'),indent=1)
print(f"SUBSCOPED relevant unique NEW threads: {len(rel)}")
for r in rel:
    print(f"  [{r['num_comments']}c {r['score']}p] r/{r['sub']} {r['id']} {r['title'][:90]}")
PY

echo "=== comment pulls (>=2c) $(date) ===">>"$LOG"
python3 -c "import json;[print(r['id']) for r in json.load(open('$OUT/subscoped_relevant.json')) if r['num_comments']>=2][:50]" | while read -r lid; do
  [ -z "$lid" ] && continue
  fetch "https://api.pullpush.io/reddit/search/comment/?link_id=${lid}&size=100" "$OUT/comments/${lid}.json"
  c=$(python3 -c "import json;print(len(json.load(open('$OUT/comments/${lid}.json'))['data']))" 2>/dev/null||echo 0)
  echo "thread ${lid} -> ${c}c">>"$LOG"; sleep 4
done
echo "=== DONE $(date) ===">>"$LOG"
