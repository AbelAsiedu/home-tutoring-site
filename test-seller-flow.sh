#!/bin/bash
# Test seller onboarding flow

BASE_URL="http://localhost:3001"

echo "Step 1: Check seller apply page (should redirect to login if not authenticated)..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "$BASE_URL/marketplace/seller/apply"

echo ""
echo "Step 2: Check creator dashboard (should require creator role)..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "$BASE_URL/marketplace/creator/dashboard"

echo ""
echo "Step 3: Check seller admin page (should require admin)..."
curl -s -o /dev/null -w "Status: %{http_code}\n" "$BASE_URL/admin/seller-applications"

echo ""
echo "Test API: Check if seller_applications table exists..."
sqlite3 data.db "SELECT name FROM sqlite_master WHERE type='table' AND name='seller_applications';"
