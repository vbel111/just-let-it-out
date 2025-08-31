# Deployment Instructions

## Vercel Environment Variables

This project uses a secure build-time injection system for Firebase configuration.

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

### How It Works:

1. **Source Code**: Contains placeholder tokens (`%VITE_FIREBASE_API_KEY%`) instead of real keys
2. **Build Process**: Vercel runs `build.sh` which replaces placeholders with actual environment variables
3. **Security**: No sensitive data is ever committed to git or visible in source code
4. **Validation**: Build fails if environment variables are missing

### Local Development:

For local development, copy `.env.example` to `.env` and fill in your Firebase configuration values.

## Security Benefits:

- ✅ No hardcoded API keys in source code
- ✅ Environment variables injected only at build time
- ✅ Build fails if configuration is missing
- ✅ Source code is completely safe to commit publicly
