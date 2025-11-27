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
            const { placeName, address, photoReference } = requestData;
            if (!placeName) {
                return res.status(400).json({ error: 'Place name is required for photo search' });
            }
            
            const photoUrl = await searchPlacePhoto(placeName, address, photoReference);
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

    // Build specific requirements only when user makes selections
    let requirements = [];
    
    if (indoorOutdoor && indoorOutdoor !== '') {
        requirements.push(`MUST be ${indoorOutdoor} activities ONLY`);
    }
    
    if (costPreference && costPreference !== '') {
        const costText = costPreference === 'free' ? 'free activities ONLY' : 'paid activities ONLY';
        requirements.push(`MUST be ${costText}`);
    }
    
    if (timeAvailable && timeAvailable !== '') {
        let timeReq = '';
        switch(timeAvailable) {
            case 'under-hour':
                timeReq = 'MUST be activities that can be completed in under an hour';
                break;
            case 'couple-hours':
                timeReq = 'MUST be activities suitable for 2-3 hours';
                break;
            case 'make-day':
                timeReq = 'MUST be full-day activities and destinations';
                break;
        }
        requirements.push(timeReq);
    }

    // Build optimized prompt with clear requirements
    let prompt = `Find exactly 5 kid-friendly places ${distanceConstraint} ${location} for children aged ${ages}.`;
    
    if (requirements.length > 0) {
        prompt += `\n\nREQUIREMENTS:\n- ${requirements.join('\n- ')}`;
        prompt += `\n\nDO NOT include places that don't match these requirements.`;
    }
    
    prompt += `\n\nReturn ONLY a JSON array with natural language descriptions explaining why each is a good recommendation.`;

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
async function searchPlacePhoto(placeName, address, photoReference) {
    try {
        let finalPhotoReference = photoReference;
        
        // If we don't have a photoReference from Gemini, search for the place
        if (!finalPhotoReference || finalPhotoReference.trim() === '') {
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
                
                // Get photo reference from search results
                if (place.photos && place.photos.length > 0) {
                    finalPhotoReference = place.photos[0].photo_reference;
                }
            }
        }
        
        // If we have a photo reference (either from Gemini or from search), fetch the image
        if (finalPhotoReference) {
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${finalPhotoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            
            // Fetch the actual image and convert to base64
            const imageResponse = await fetch(photoUrl);
            if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                return `data:${contentType};base64,${base64Image}`;
            }
        }
        
        return null; // No photo found
    } catch (error) {
        console.error('Error searching for place photo:', error);
        return null; // Return null on error so frontend can use placeholder
    }
}
