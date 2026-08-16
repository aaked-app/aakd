#!/usr/bin/env bash
# Serial, rate-limit-safe Reddit CLM sweep via pullpush.io.
# Strategy: few BROAD global term searches (cuts call volume), then serial
# comment-tree pulls for new relevant threads. sleep + 429-backoff throughout.
set -uo pipefail

OUT="/Users/wassimbensalem/Desktop/Projects-Extra/CLM/research/audit-2026-07-16/reddit-raw"
mkdir -p "$OUT/submissions" "$OUT/comments"
LOG="$OUT/scrape.log"
: > "$LOG"

# Already-covered threads (skip comment re-pulls) from prior two passes
SEEN="19392l3 1huyhwz 1bipens 1abrw89 1ftgspf 1hv84tf 1kpnn06"

TERMS=(
  "contract management"
  "contract lifecycle"
  "CLM software"
  "contract tracker"
  "track contracts"
  "renewal reminder"
  "contract repository"
  "manage contracts"
  "open source contract"
  "self hosted contract"
  "contract renewal software"
  "contract expiration"
)

# curl with 429 backoff, serial
fetch() { # url outfile
  local url="$1" out="$2" tries=0 code
  while :; do
    code=$(curl -s "$url" -o "$out" -w "%{http_code}")
    if [ "$code" = "200" ]; then return 0; fi
    if [ "$code" = "429" ]; then
      tries=$((tries+1)); [ $tries -gt 4 ] && { echo "GIVEUP 429 $url" >>"$LOG"; return 1; }
      echo "429 backoff ${tries} on $url" >>"$LOG"; sleep $((tries*20)); continue
    fi
    echo "HTTP $code $url" >>"$LOG"; return 1
  done
}

echo "=== submission sweep ($(date)) ===" >>"$LOG"
i=0
for term in "${TERMS[@]}"; do
  i=$((i+1))
  enc=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$term")
  fetch "https://api.pullpush.io/reddit/search/submission/?q=${enc}&size=100&sort=desc&sort_type=score" "$OUT/submissions/term_${i}.json"
  n=$(python3 -c "import json;print(len(json.load(open('$OUT/submissions/term_${i}.json'))['data']))" 2>/dev/null || echo 0)
  echo "term '${term}' -> ${n} submissions" >>"$LOG"
  sleep 3
done

# Aggregate relevant submissions: CLM-ish title/selftext + >=2 comments, dedup, drop SEEN
python3 - "$OUT" "$SEEN" >>"$LOG" 2>&1 <<'PY'
import json,glob,re,sys,os
out=sys.argv[1]; seen=set(sys.argv[2].split())
rx=re.compile(r'contract', re.I)
rows={}
for f in glob.glob(out+'/submissions/term_*.json'):
    try: data=json.load(open(f))['data']
    except: continue
    for d in data:
        idd=d.get('id');
        if not idd or idd in seen: continue
        text=(d.get('title','')+' '+d.get('selftext',''))
        if not rx.search(text): continue
        rows[idd]={'id':idd,'sub':d.get('subreddit'),'title':d.get('title'),
                   'score':d.get('score',0),'num_comments':d.get('num_comments',0),
                   'created':d.get('created_utc'),'permalink':d.get('permalink'),
                   'selftext':(d.get('selftext') or '')[:1000]}
rel=sorted(rows.values(), key=lambda r:(r['num_comments'],r['score']), reverse=True)
json.dump(rel, open(out+'/relevant_submissions.json','w'), indent=1)
print(f"AGG relevant unique submissions: {len(rel)}")
for r in rel[:40]:
    print(f"  [{r['num_comments']}c {r['score']}p] r/{r['sub']} {r['id']} {r['title'][:80]}")
PY

# Pull comment trees for relevant subs with >=2 comments (serial)
echo "=== comment tree pull ($(date)) ===" >>"$LOG"
python3 -c "import json;[print(r['id']) for r in json.load(open('$OUT/relevant_submissions.json')) if r['num_comments']>=2]" 2>/dev/null | while read -r lid; do
  [ -z "$lid" ] && continue
  fetch "https://api.pullpush.io/reddit/search/comment/?link_id=${lid}&size=100" "$OUT/comments/${lid}.json"
  c=$(python3 -c "import json;print(len(json.load(open('$OUT/comments/${lid}.json'))['data']))" 2>/dev/null || echo 0)
  echo "thread ${lid} -> ${c} comments" >>"$LOG"
  sleep 3
done

echo "=== DONE ($(date)) ===" >>"$LOG"
echo "submissions: $(ls $OUT/submissions | wc -l | tr -d ' ') | comment-trees: $(ls $OUT/comments | wc -l | tr -d ' ')" >>"$LOG"
