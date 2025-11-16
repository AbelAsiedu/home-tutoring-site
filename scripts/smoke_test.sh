#!/usr/bin/env bash
# Simple smoke tests for parental dashboard APIs
set -euo pipefail
BASE=http://localhost:3001
echo "Listing lessons for sample students..."
curl -sS "$BASE/api/lessons?user_id=student-1" | jq '.' || true
curl -sS "$BASE/api/lessons?user_id=test-student" | jq '.' || true

echo "Fetching dashboard for sample student (test-student)..."
curl -sS "$BASE/api/dashboard?user_id=test-student" | jq '.' || true

echo "Fetching a lesson details (first lesson for test-student)..."
LID=$(curl -sS "$BASE/api/lessons?user_id=test-student" | jq -r '.[0].id')
if [ "$LID" = "null" ] || [ -z "$LID" ]; then
  echo "No lesson found; aborting lesson detail fetch"
  exit 0
fi
curl -sS "$BASE/api/lessons/$LID" | jq '.' || true

echo "Smoke tests complete"
