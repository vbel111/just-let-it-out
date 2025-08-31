// Build script for Vercel - replaces environment variable placeholders
const fs = require('fs');
const path = require('path');

console.log('🔧 Injecting Firebase configuration from environment variables...');

// Define the config file path
const configFile = path.join(__dirname, 'public', 'js', 'firebase-config.js');

// Read the file
let content = fs.readFileSync(configFile, 'utf8');

// Replace placeholders with environment variables
const replacements = {
  '%VITE_FIREBASE_API_KEY%': process.env.VITE_FIREBASE_API_KEY,
  '%VITE_FIREBASE_AUTH_DOMAIN%': process.env.VITE_FIREBASE_AUTH_DOMAIN,
  '%VITE_FIREBASE_DATABASE_URL%': process.env.VITE_FIREBASE_DATABASE_URL,
  '%VITE_FIREBASE_PROJECT_ID%': process.env.VITE_FIREBASE_PROJECT_ID,
  '%VITE_FIREBASE_STORAGE_BUCKET%': process.env.VITE_FIREBASE_STORAGE_BUCKET,
  '%VITE_FIREBASE_MESSAGING_SENDER_ID%': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  '%VITE_FIREBASE_APP_ID%': process.env.VITE_FIREBASE_APP_ID,
  '%VITE_FIREBASE_MEASUREMENT_ID%': process.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Apply replacements
for (const [placeholder, value] of Object.entries(replacements)) {
  if (value) {
    content = content.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  } else {
    console.error(`❌ Missing environment variable for ${placeholder}`);
    process.exit(1);
  }
}

// Write the updated file
fs.writeFileSync(configFile, content);

// Verify that replacements worked
if (content.includes('%VITE_FIREBASE_API_KEY%')) {
  console.error('❌ Error: Environment variables not properly injected');
  console.error('Please ensure all VITE_FIREBASE_* variables are set in Vercel dashboard');
  process.exit(1);
}

console.log('✅ Firebase configuration injected successfully');
console.log('🚀 Build complete - ready for deployment');
