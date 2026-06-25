#!/bin/bash
# Robust batch uploader — runs each batch in foreground with strict timeout.
# Resumable via .done markers.

COOKIE="session_token=ab2bb960-434b-4eab-b57e-57572de84142-0a0e211a-6e55-4525-8778-792359aac2b7"
BATCH_DIR="/home/z/my-project/upload/batches"
DONE_DIR="$BATCH_DIR/done"
mkdir -p "$DONE_DIR"

TOTAL_PROCESSED=0
TOTAL_SKIPPED=0
BATCHES_DONE=0

# Get list of batches NOT yet done
for batch in "$BATCH_DIR"/batch_*.csv; do
  basename=$(basename "$batch")
  done_marker="$DONE_DIR/${basename}.done"
  if [ -f "$done_marker" ] && grep -q "processed=" "$done_marker"; then
    PROCESSED=$(grep "processed=" "$done_marker" | cut -d= -f2)
    SKIPPED=$(grep "skipped=" "$done_marker" | cut -d= -f2)
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + ${PROCESSED:-0}))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + ${SKIPPED:-0}))
    BATCHES_DONE=$((BATCHES_DONE + 1))
    continue
  fi

  # Upload with strict 30s timeout — if it fails, move on and we'll retry next loop
  RESULT=$(timeout 30 curl -s -m 30 -X POST "https://dfcl-inv.vercel.app/api/stock/bulk-upload?mode=set" \
    -H "Cookie: $COOKIE" \
    -F "file=@$batch" 2>&1)

  if echo "$RESULT" | grep -q '"success":true'; then
    PROCESSED=$(echo "$RESULT" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('processed',0))" 2>/dev/null || echo "0")
    SKIPPED=$(echo "$RESULT" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('skipped',0))" 2>/dev/null || echo "0")
    echo "OK: $basename — processed=$PROCESSED skipped=$SKIPPED"
    echo "processed=$PROCESSED" > "$done_marker"
    echo "skipped=$SKIPPED" >> "$done_marker"
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
  else
    echo "FAIL: $basename — $(echo "$RESULT" | head -c 100)"
  fi
  BATCHES_DONE=$((BATCHES_DONE + 1))
done

echo ""
echo "============================================"
echo "TOTAL PROCESSED: $TOTAL_PROCESSED"
echo "TOTAL SKIPPED: $TOTAL_SKIPPED"
echo "BATCHES DONE: $BATCHES_DONE / 66"
echo "============================================"
