#!/bin/bash
# Upload all batches sequentially, with retry + progress tracking.
# Resumable — skips batches that already have a .done marker.

COOKIE="session_token=ab2bb960-434b-4eab-b57e-57572de84142-0a0e211a-6e55-4525-8778-792359aac2b7"
BATCH_DIR="/home/z/my-project/upload/batches"
DONE_DIR="/home/z/my-project/upload/batches/done"
mkdir -p "$DONE_DIR"

TOTAL_PROCESSED=0
TOTAL_SKIPPED=0
TOTAL_FAILED=0
BATCHES_DONE=0
BATCHES_TOTAL=$(ls "$BATCH_DIR"/batch_*.csv 2>/dev/null | wc -l)

echo "Starting upload of $BATCHES_TOTAL batches (500 rows each)..."
echo "Progress will be saved to $DONE_DIR/ so we can resume if interrupted."
echo ""

for batch in "$BATCH_DIR"/batch_*.csv; do
  basename=$(basename "$batch")
  done_marker="$DONE_DIR/${basename}.done"

  # Skip if already done
  if [ -f "$done_marker" ]; then
    PROCESSED=$(cat "$done_marker" 2>/dev/null | grep "processed=" | cut -d= -f2)
    SKIPPED=$(cat "$done_marker" 2>/dev/null | grep "skipped=" | cut -d= -f2)
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + ${PROCESSED:-0}))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + ${SKIPPED:-0}))
    BATCHES_DONE=$((BATCHES_DONE + 1))
    echo "[$BATCHES_DONE/$BATCHES_TOTAL] SKIP (already done): $basename"
    continue
  fi

  echo -n "[$BATCHES_DONE/$BATCHES_TOTAL] Uploading $basename... "

  # Try up to 3 times
  SUCCESS=0
  for attempt in 1 2 3; do
    RESULT=$(curl -s -m 90 -X POST "https://dfcl-inv.vercel.app/api/stock/bulk-upload?mode=set" \
      -H "Cookie: $COOKIE" \
      -F "file=@$batch" 2>&1)

    if echo "$RESULT" | grep -q '"success":true'; then
      PROCESSED=$(echo "$RESULT" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('processed',0))" 2>/dev/null || echo "0")
      SKIPPED=$(echo "$RESULT" | python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print(d.get('skipped',0))" 2>/dev/null || echo "0")
      echo "OK (attempt $attempt) — processed=$PROCESSED skipped=$SKIPPED"
      echo "processed=$PROCESSED" > "$done_marker"
      echo "skipped=$SKIPPED" >> "$done_marker"
      TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
      SUCCESS=1
      break
    else
      echo -n "FAIL (attempt $attempt)... "
      sleep 2
    fi
  done

  if [ $SUCCESS -eq 0 ]; then
    echo "FAILED after 3 attempts"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
    echo "FAILED" > "$done_marker"
  fi

  BATCHES_DONE=$((BATCHES_DONE + 1))
done

echo ""
echo "============================================"
echo "FINAL TOTALS"
echo "============================================"
echo "Batches done: $BATCHES_DONE / $BATCHES_TOTAL"
echo "Total rows processed: $TOTAL_PROCESSED"
echo "Total rows skipped: $TOTAL_SKIPPED"
echo "Failed batches: $TOTAL_FAILED"
echo "============================================"
