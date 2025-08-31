#!/bin/bash

# Vercel build script - replaces environment variable placeholders
echo "🔧 Injecting Firebase configuration from environment variables..."

# Define the config file path
CONFIG_FILE="public/js/firebase-config.js"

# Replace placeholders with environment variables
sed -i "s|%VITE_FIREBASE_API_KEY%|$VITE_FIREBASE_API_KEY|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_AUTH_DOMAIN%|$VITE_FIREBASE_AUTH_DOMAIN|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_DATABASE_URL%|$VITE_FIREBASE_DATABASE_URL|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_PROJECT_ID%|$VITE_FIREBASE_PROJECT_ID|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_STORAGE_BUCKET%|$VITE_FIREBASE_STORAGE_BUCKET|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_MESSAGING_SENDER_ID%|$VITE_FIREBASE_MESSAGING_SENDER_ID|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_APP_ID%|$VITE_FIREBASE_APP_ID|g" $CONFIG_FILE
sed -i "s|%VITE_FIREBASE_MEASUREMENT_ID%|$VITE_FIREBASE_MEASUREMENT_ID|g" $CONFIG_FILE

echo "✅ Firebase configuration injected successfully"

# Verify that at least the API key was injected
if grep -q "%VITE_FIREBASE_API_KEY%" $CONFIG_FILE; then
    echo "❌ Error: Environment variables not properly injected"
    echo "Please ensure all VITE_FIREBASE_* variables are set in Vercel dashboard"
    exit 1
fi

echo "🚀 Build complete - ready for deployment"
