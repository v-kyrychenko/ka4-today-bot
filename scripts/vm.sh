#!/usr/bin/env bash
set -euo pipefail

usage() {
    echo "Usage: $0 <start|stop>"
}

if [[ $# -ne 1 ]]; then
    usage
    exit 1
fi

ACTION="$1"
REGION="${AWS_REGION:-eu-central-1}"
NAME="${INSTANCE_NAME:-ka4-today-postgres-nat}"

case "$ACTION" in
    start)
        SOURCE_STATE="stopped"
        TARGET_COMMAND="start-instances"
        ;;
    stop)
        SOURCE_STATE="running"
        TARGET_COMMAND="stop-instances"
        ;;
    *)
        usage
        exit 1
        ;;
esac

INSTANCE_ID="$(
    aws ec2 describe-instances \
        --filters "Name=tag:Name,Values=$NAME" "Name=instance-state-name,Values=$SOURCE_STATE" \
        --query "Reservations[0].Instances[0].InstanceId" \
        --output text \
        --region "$REGION"
)"

if [[ -z "$INSTANCE_ID" || "$INSTANCE_ID" == "None" ]]; then
    echo "No instance found for Name=$NAME in state=$SOURCE_STATE."
    exit 1
fi

aws ec2 "$TARGET_COMMAND" --instance-ids "$INSTANCE_ID" --region "$REGION"
