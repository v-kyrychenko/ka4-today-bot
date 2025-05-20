#!/bin/bash

# Usage: sh scripts/watch-logs.sh ka4today
# Streams all CloudWatch logs for Lambda functions with given prefix.

PREFIX=$1
REGION="eu-central-1"

if [ -z "$PREFIX" ]; then
  echo "❌ Usage: $0 <lambda-name-prefix>"
  exit 1
fi

# Build search prefix
LOG_GROUP_PREFIX="/aws/lambda/${PREFIX}"

# Find all matching log groups
LOG_GROUPS=$(aws logs describe-log-groups \
  --log-group-name-prefix "$LOG_GROUP_PREFIX" \
  --region "$REGION" \
  --query "logGroups[].logGroupName" \
  --output text)

if [ -z "$LOG_GROUPS" ]; then
  echo "❌ No log groups found for prefix: $LOG_GROUP_PREFIX"
  exit 1
fi

echo "📡 Streaming logs for groups with prefix: $LOG_GROUP_PREFIX"
echo "🌍 Region: ${REGION}"
echo "----------------------------------------"

for LOG_GROUP in $LOG_GROUPS; do
  echo "▶️ Tailing: $LOG_GROUP"
  aws logs tail "$LOG_GROUP" \
    --follow \
    --region "$REGION" \
    --format short &
done

# Wait for all background tails to finish (on Ctrl+C)
wait
