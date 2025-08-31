# Deployment Instructions

## Vercel Environment Variables

Before deploying to Vercel, you must set the following environment variables in your Vercel project dashboard:

### Required Environment Variables:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add the following variables:

```
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

3. Set the environment for: **Production**, **Preview**, and **Development**
4. Redeploy your project after adding the variables

## Security Notes:

- Never commit your `.env` file to git
- The source code no longer contains hardcoded API keys
- Environment variables are injected at build time by Vercel
- If environment variables are missing, the app will throw an error instead of using fallback values

## Local Development:

Copy `.env.example` to `.env` and fill in your Firebase configuration values for local development.
