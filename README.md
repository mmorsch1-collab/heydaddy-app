# Daddy, what are we doing today?

A mobile-first web app to help parents find kid-friendly activities and places near them. This is a standalone recreation of the Bubble app at https://dwawdt.bubbleapps.io.

## 🚀 Quick Start

### Local Development

```bash
cd daddy-app-prototype
npm install
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Environment Setup

1. Copy the environment file:
   ```bash
   cp .env.example .env
   ```

2. The API keys are already configured in `.env.example`:
   - `GEMINI_API_KEY`: For AI-powered place recommendations
   - `GOOGLE_MAPS_API_KEY`: For place photos

## 🏗️ Architecture

### Frontend
- **Vanilla JavaScript**: No framework dependencies for fast loading
- **Mobile-First CSS**: Optimized for 375px screens
- **localStorage**: Remembers user's kids' ages and location

### Backend
- **Serverless Function**: `api/getRecommendations.js`
- **Gemini 2.5-Flash**: AI recommendations with structured JSON output
- **Google Places Photos**: Real images for every location
- **<3 Second Response**: Optimized for speed, no fallbacks

### APIs Used
1. **Gemini API**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
2. **Google Places Photos**: `https://maps.googleapis.com/maps/api/place/photo`
3. **Google Maps Search**: `https://www.google.com/maps/search/?api=1&query=`

## 🔄 User Flow

1. **Input**: User enters kids' ages and location
2. **Filters**: Optional indoor/outdoor, cost, time preferences  
3. **Search**: Gemini AI generates 5 contextual recommendations
4. **Results**: Places shown with photos and ratings
5. **Navigate**: Tap any place to open in Google Maps

## 📱 Deployment

### Deploy to Netlify

1. **Connect Repository**: Link your GitHub repo to Netlify
2. **Build Settings**: 
   - Build command: `npm run build`
   - Publish directory: `.` (root)
3. **Environment Variables**: Set in Netlify dashboard
   - `GEMINI_API_KEY=AIzaSyDB5PIIYxPi7cAnCSILR7sKfhUNZYySBu4`
   - `GOOGLE_MAPS_API_KEY=AIzaSyDr4zafXO0Y5zx681q8f3XKwtRdCJ3H42I`
4. **Deploy**: Netlify will use `netlify.toml` configuration automatically

### Deploy to Vercel

1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Environment Variables**: Set in Vercel dashboard
   - `GEMINI_API_KEY=AIzaSyDB5PIIYxPi7cAnCSILR7sKfhUNZYySBu4`
   - `GOOGLE_MAPS_API_KEY=AIzaSyDr4zafXO0Y5zx681q8f3XKwtRdCJ3H42I`
3. **Deploy**: Vercel will use `vercel.json` configuration automatically

## 🧪 Testing

### Test the App Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test the complete flow:
   - Enter ages: `4, 7`
   - Enter location: `Boston, MA`
   - Optionally set filters in "More options"
   - Click "Get ideas"
   - Verify results load in <3 seconds
   - Click place cards to test Google Maps integration

### API Response Format

The Gemini API returns this exact structure:
```json
[
  {
    "name": "Children's Museum of Science",
    "description": "Interactive exhibits perfect for curious minds aged 4-7",
    "address": "1 Science Park, Boston, MA 02114",
    "rating": 4.6,
    "place_id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
    "photo_reference": "ATplDJa7_abc123..."
  }
]
```

## 🎯 Performance Optimizations

- **Fast API Calls**: Direct Gemini 2.5-flash integration
- **Lazy Loading**: Images load only when needed
- **No Fallbacks**: Errors shown directly (no slow mock data)
- **Optimized Prompts**: Structured JSON schema for consistent responses
- **Real Photos**: Google Places Photos API for visual appeal

## 🔧 Technical Details

### Frontend Architecture
- `DaddyApp` class manages all state and UI interactions
- localStorage automatically saves user preferences
- Smooth scrolling between form and results
- Accessible keyboard navigation on place cards

### Backend Architecture  
- Serverless function handles CORS and validation
- Structured Gemini prompts with exact JSON schema
- Error handling with detailed messages (no silent failures)
- Photo URLs constructed with Google Places API

### Mobile-First Design
- 375px primary breakpoint (iPhone standard)
- Touch-optimized interactions
- Fixed bottom action bar
- Responsive place cards with images

## 🚨 Error Handling

The app shows specific error messages instead of fallbacks:
- API failures display actual error text
- Invalid responses show parsing errors  
- Network issues display connection errors
- No mock data or placeholder content

This ensures real-time debugging and optimal user experience when APIs are working correctly.

## 📋 Project Structure

```
daddy-app-prototype/
├── index.html              # Main app page
├── styles.css              # Mobile-first styles  
├── app.js                  # Frontend logic
├── api/
│   └── getRecommendations.js  # Serverless API endpoint
├── package.json            # Dependencies and scripts
├── netlify.toml           # Netlify deployment config
├── vercel.json            # Vercel deployment config
└── .env.example           # Environment variables template
```

Ready to deploy and use with your exact API configuration!
