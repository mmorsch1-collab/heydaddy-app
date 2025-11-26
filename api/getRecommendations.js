// Vercel serverless function for getting kid-friendly recommendations
// Optimized for <3 second response times

export default async function handler(req, res) {
    // Handle CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const requestData = req.body;
        
        // Check if this is a photo search request
        if (requestData.action === 'searchPhoto') {
            const { placeName, address } = requestData;
            if (!placeName) {
                return res.status(400).json({ error: 'Place name is required for photo search' });
            }
            
            const photoUrl = await searchPlacePhoto(placeName, address);
            return res.status(200).json({ photoUrl });
        }

        // Default to recommendations request
        const { ages, location, indoorOutdoor, costPreference, timeAvailable, distance } = requestData;

        // Validate required fields
        if (!ages || !location) {
            return res.status(400).json({ error: 'Ages and location are required' });
        }

        // Always use Gemini API - no fallbacks
        const results = await getGeminiRecommendations(requestData);

        return res.status(200).json(results);

    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ 
            error: 'Failed to process request: ' + error.message 
        });
    }
}

// Get recommendations using Google Gemini API with user's exact configuration
async function getGeminiRecommendations(requestData) {
    const { ages, location, indoorOutdoor, costPreference, timeAvailable, distance } = requestData;

    // Build distance constraint
    let distanceConstraint = '';
    if (distance) {
        switch(distance) {
            case '15-min':
                distanceConstraint = 'within a 15 minute drive of';
                break;
            case '30-min':
                distanceConstraint = 'within a 30 minute drive of';
                break;
            case '1-hour':
                distanceConstraint = 'within a 1 hour drive of';
                break;
            default:
                distanceConstraint = 'near';
        }
    } else {
        distanceConstraint = 'near';
    }

    // Build time availability constraint
    let timeConstraint = '';
    if (timeAvailable) {
        switch(timeAvailable) {
            case 'under-hour':
                timeConstraint = 'activities that can be enjoyed in under an hour';
                break;
            case 'couple-hours':
                timeConstraint = 'activities suitable for a couple hours';
                break;
            case 'make-day':
                timeConstraint = 'full-day activities and destinations';
                break;
            default:
                timeConstraint = 'any amount of time';
        }
    } else {
        timeConstraint = 'any amount of time';
    }

    // Use your exact Bubble app format with template substitution
    let prompt = `Find 5 kid-friendly places ${distanceConstraint} ${location} for children aged ${ages}. Consider ${costPreference || 'any cost'}, ${indoorOutdoor || 'indoor or outdoor'}, and ${timeConstraint} availability. Provide a natural language description explaining why each is a good recommendation. Return ONLY a JSON array that strictly follows the provided schema.`;

    // Use your exact Bubble app JSON structure
    const requestBody = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "ARRAY",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "name": {
                            "type": "STRING",
                            "description": "The name of the place."
                        },
                        "description": {
                            "type": "STRING",
                            "description": "A brief natural language description of why this is a good recommendation for the specified ages/constraints."
                        },
                        "address": {
                            "type": "STRING",
                            "description": "The full address of the location."
                        },
                        "rating": {
                            "type": "NUMBER",
                            "description": "The user rating for the place."
                        },
                        "place_id": {
                            "type": "STRING",
                            "description": "The official Google Maps Place ID (e.g., ChIJrTLr-GyuEmsRBfyQYjg0kM0)."
                        },
                        "photo_reference": {
                            "type": "STRING",
                            "description": "A valid Google Places Photos API reference token (e.g., 'Aap_uEA7vb0DDYVJWEaX3O-AtYp3').Leave empty if no photo available."
                        }
                    },
                    "required": ["name", "description", "address", "rating", "place_id"]
                }
            }
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} - ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            const jsonText = data.candidates[0].content.parts[0].text;
            const results = JSON.parse(jsonText);
            return Array.isArray(results) ? results : [results];
        }

        throw new Error('Invalid response format from Gemini API');

    } catch (error) {
        console.error('Gemini API error:', error);
        throw error; // No fallbacks - show actual errors
    }
}

// Search for place photos using Google Places API
async function searchPlacePhoto(placeName, address) {
    try {
        // Build search query
        const query = address ? `${placeName} ${address}` : placeName;
        
        // Step 1: Find place using Places API Text Search
        const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
        
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
            throw new Error(`Places search failed: ${searchResponse.status}`);
        }
        
        const searchData = await searchResponse.json();
        
        if (searchData.results && searchData.results.length > 0) {
            const place = searchData.results[0];
            
            // Step 2: If place has photos, fetch and return the actual image data
            if (place.photos && place.photos.length > 0) {
                const photoReference = place.photos[0].photo_reference;
                const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
                
                // Fetch the actual image and convert to base64
                const imageResponse = await fetch(photoUrl);
                if (imageResponse.ok) {
                    const imageBuffer = await imageResponse.arrayBuffer();
                    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                    const base64Image = Buffer.from(imageBuffer).toString('base64');
                    return `data:${contentType};base64,${base64Image}`;
                }
            }
        }
        
        return null; // No photo found
    } catch (error) {
        console.error('Error searching for place photo:', error);
        return null; // Return null on error so frontend can use placeholder
    }
}
