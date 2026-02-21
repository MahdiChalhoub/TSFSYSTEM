#!/bin/bash

# generate_prod_env.sh
# Generates a production-ready .env file if it doesn't already exist.

ENV_FILE=".env"
EXAMPLE_FILE=".env.example"

if [ -f "$ENV_FILE" ]; then
    echo "⚠️  $ENV_FILE already exists. Skipping generation."
    exit 0
fi

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo "❌  $EXAMPLE_FILE not found! Cannot generate env file."
    exit 1
fi

echo "🚀  Generating production .env file..."

# Copy example to .env
cp "$EXAMPLE_FILE" "$ENV_FILE"

# Generate a random 50-character secret key
# (Compatible with standard Django format)
RANDOM_KEY=$(LC_ALL=C tr -dc 'a-zA-Z0-9!@#$%^&*(-_=+)' </dev/urandom | head -c 50)

# Replace the placeholder in the new .env file
# We use a different separator for sed because the key might contain /
sed -i "s|YOUR_SECRET_KEY_HERE|$RANDOM_KEY|g" "$ENV_FILE"

echo "✅  .env generated with a unique DJANGO_SECRET_KEY."
echo "👉  IMPORTANT: Open $ENV_FILE and set your real DB_PASSWORD and other credentials!"
