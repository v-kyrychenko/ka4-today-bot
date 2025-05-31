#!/bin/bash
ENDPOINT="http://localhost:8000"

TABLE_NAME_USERS="ka4-today-users"
echo "🧱 Creating table: $TABLE_NAME_USERS"
aws dynamodb create-table \
  --table-name $TABLE_NAME_USERS \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
      AttributeName=chat_id,AttributeType=N \
      AttributeName=is_active,AttributeType=N \
  --key-schema \
      AttributeName=chat_id,KeyType=HASH \
  --global-secondary-indexes '[
    {
      "IndexName": "ActiveUsersIndex",
      "KeySchema": [
        {"AttributeName": "is_active", "KeyType": "HASH"}
      ],
      "Projection": {
        "ProjectionType": "INCLUDE",
        "NonKeyAttributes": ["chat_id"]
      }
    }
  ]' \
  --endpoint-url $ENDPOINT
echo "✅ Table '$TABLE_NAME_USERS' created successfully."

TABLE_NAME_SCHEDULE="ka4-today-users-training-schedule"
echo "🧱 Creating table: $TABLE_NAME_SCHEDULE"
aws dynamodb create-table \
  --table-name $TABLE_NAME_SCHEDULE \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=chat_id,AttributeType=N \
    AttributeName=day_of_week,AttributeType=S \
  --key-schema \
    AttributeName=chat_id,KeyType=HASH \
    AttributeName=day_of_week,KeyType=RANGE \
  --global-secondary-indexes '[
    {
      "IndexName": "ScheduleByDay",
      "KeySchema": [
        {"AttributeName": "day_of_week", "KeyType": "HASH"},
        {"AttributeName": "chat_id", "KeyType": "RANGE"}
      ],
      "Projection": {
        "ProjectionType": "ALL"
      }
    }
  ]' \
  --endpoint-url $ENDPOINT

echo "✅ Table '$TABLE_NAME_SCHEDULE' created successfully."

TABLE_NAME_PROMPTS="ka4-today-prompts"
echo "🧱 Creating table: $TABLE_NAME_PROMPTS"
aws dynamodb create-table \
  --table-name $TABLE_NAME_PROMPTS \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=prompt_id,AttributeType=S \
    AttributeName=version,AttributeType=N \
  --key-schema \
    AttributeName=prompt_id,KeyType=HASH \
    AttributeName=version,KeyType=RANGE \
  --endpoint-url http://localhost:8000

echo "✅ Table '$TABLE_NAME_PROMPTS' created successfully."

TABLE_NAME_TRAINERS="ka4-today-trainers"
echo "🧱 Creating table: $TABLE_NAME_TRAINERS"
aws dynamodb create-table \
  --table-name $TABLE_NAME_TRAINERS \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=trainer_id,AttributeType=N \
  --key-schema \
    AttributeName=trainer_id,KeyType=HASH \
  --endpoint-url http://localhost:8000
echo "✅ Table '$TABLE_NAME_TRAINERS' created successfully."

TABLE_NAME_LOG="ka4-today-log"
echo "🧱 Creating table: $TABLE_NAME_LOG"
aws dynamodb create-table \
  --table-name $TABLE_NAME_LOG \
  --billing-mode PAY_PER_REQUEST \
  --attribute-definitions \
    AttributeName=chat_id,AttributeType=N \
    AttributeName=timestamp,AttributeType=S \
  --key-schema \
    AttributeName=chat_id,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --endpoint-url http://localhost:8000

echo "✅ Table '$TABLE_NAME_LOG' created successfully."