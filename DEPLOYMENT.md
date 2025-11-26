# Vercel Deployment Guide

## Changes Made for Vercel Compatibility

✅ **Node.js Version Updated**: Changed from 18.x to 20.x
✅ **Serverless Function Converted**: Updated from Netlify to Vercel format
✅ **Runtime Configuration**: Updated to use `nodejs20.x` runtime

## Deployment Steps

### 1. Push Code Changes to GitHub
Make sure all your changes are committed and pushed to your GitHub repository:

```bash
cd daddy-app-prototype
git add .
git commit -m "Update for Vercel compatibility - Node.js 20.x and function format"
git push origin main
```

### 2. Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**
```bash
npx vercel
```

**Option B: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect the configuration

### 3. Configure Environment Variables

In your Vercel project dashboard, go to Settings > Environment Variables and add:

**Production Variables:**
- `GEMINI_API_KEY` = `AIzaSyDB5PIIYxPi7cAnCSILR7sKfhUNZYySBu4`
- `GOOGLE_PLACES_API_KEY` = `AIzaSyDr4zafXO0Y5zx681q8f3XKwtRdCJ3H42I`

**Development Variables (Optional):**
Add the same keys for Preview and Development environments if needed.

### 4. Test Your Deployment

Once deployed, your app will be available at: `https://your-project-name.vercel.app`

Test the functionality:
1. Fill out the activity form
2. Submit to get recommendations
3. Verify API calls are working properly

## Key Changes Summary

### Function Format Change
- **Before (Netlify)**: `exports.handler = async (event, context) => {...}`
- **After (Vercel)**: `export default async function handler(req, res) {...}`

### Request/Response Handling
- **Before**: Used `event.body`, `event.httpMethod`
- **After**: Uses `req.body`, `req.method`, `res.status().json()`

### CORS Handling
- **Before**: Returned headers in response object
- **After**: Uses `res.setHeader()` method

All your app logic, API integrations, and user experience remain identical!
