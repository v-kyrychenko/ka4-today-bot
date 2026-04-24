#!/usr/bin/env bash
set -euo pipefail

REGION="${AWS_REGION:-eu-central-1}"
INSTANCE_NAME="${INSTANCE_NAME:-ka4-today-postgres-nat}"
REMOTE_HOST="${REMOTE_HOST:-10.42.0.33}"
REMOTE_PORT="${REMOTE_PORT:-5432}"
LOCAL_PORT="${LOCAL_PORT:-54322}"

INSTANCE_ID="$(
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$INSTANCE_NAME" "Name=instance-state-name,Values=running" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text \
        --region "$REGION"
)"

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
    echo "No running instance found for Name=$INSTANCE_NAME."
    exit 1
fi

aws ssm start-session \
    --target "$INSTANCE_ID" \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters "{\"host\":[\"$REMOTE_HOST\"],\"portNumber\":[\"$REMOTE_PORT\"],\"localPortNumber\":[\"$LOCAL_PORT\"]}" \
    --region "$REGION"
