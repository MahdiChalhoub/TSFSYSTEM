#!/bin/bash
echo "Testing theme API with auth..."
echo ""
echo "1. Testing WITHOUT auth token:"
curl -s -X POST http://127.0.0.1:8000/api/themes/25/activate/ -H "Content-Type: application/json" | python3 -m json.tool
echo ""
echo "2. Checking if backend sees user as authenticated in logs..."
