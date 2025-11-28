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
    const { ages, location, indoorOutdoor, costPreference, timeAvailable, distance, excludePlaces } = requestData;

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
        distanceConstraint = 'within a 1 hour drive of';
    }

    // Build specific requirements with strong enforcement
    let requirements = [];
    let exclusions = [];
    
    if (indoorOutdoor && indoorOutdoor !== '') {
        if (indoorOutdoor === 'indoor') {
            requirements.push(`MUST be indoor activities ONLY - museums, indoor play centers, libraries, shopping centers, etc.`);
            exclusions.push(`DO NOT include any outdoor activities like parks, playgrounds, beaches, hiking trails, outdoor sports`);
        } else if (indoorOutdoor === 'outdoor') {
            requirements.push(`MUST be outdoor activities ONLY - parks, playgrounds, beaches, hiking trails, outdoor sports, etc.`);
            exclusions.push(`DO NOT include any indoor activities like museums, indoor play centers, libraries, shopping centers`);
        }
    }
    
    if (costPreference && costPreference !== '') {
        if (costPreference === 'free') {
            requirements.push(`MUST be completely FREE activities with no admission fees`);
            exclusions.push(`DO NOT include any activities that charge admission fees, entrance costs, or require payment`);
        } else if (costPreference === 'paid') {
            requirements.push(`MUST be paid activities that charge admission fees`);
            exclusions.push(`DO NOT include free activities like public parks or free museums`);
        }
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

    // Add exclusion for already shown places
    if (excludePlaces && excludePlaces.length > 0) {
        const placeNames = excludePlaces.map(place => place.name).join(', ');
        exclusions.push(`DO NOT include these already shown places: ${placeNames}`);
    }

    // Build optimized prompt with aggressive enforcement and age-appropriateness priority
    let prompt = `Find up to 5 age-appropriate, kid-friendly places ${distanceConstraint} ${location} for children aged ${ages}.

AGE-APPROPRIATENESS IS THE TOP PRIORITY:
- Only include activities that are genuinely safe and developmentally appropriate for children aged ${ages}
- Consider the physical abilities, attention spans, and safety requirements for these specific ages
- When in doubt, choose safer, more conservative options over potentially inappropriate activities
- Quality over quantity: Return fewer results rather than include questionable activities`;
    
    if (requirements.length > 0) {
        prompt += `\n\nSTRICT REQUIREMENTS (ALL MUST BE MET):\n- ${requirements.join('\n- ')}`;
    }
    
    if (exclusions.length > 0) {
        prompt += `\n\nSTRICT EXCLUSIONS (NEVER INCLUDE):\n- ${exclusions.join('\n- ')}`;
    }
    
    if (requirements.length > 0 || exclusions.length > 0) {
        prompt += `\n\nIMPORTANT: Only return places that meet ALL requirements above and avoid ALL exclusions. If a place doesn't strictly match the requirements or is in the exclusion list, exclude it completely.`;
    }
    
    prompt += `\n\nReturn 1-5 results (only as many as are truly appropriate). Return ONLY a JSON array with natural language descriptions explaining why each is a good recommendation for the specified ages.`;

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
    console.log('Photo search requested for:', placeName, 'Address:', address, 'PhotoRef:', photoReference);
    
    try {
        // Check if API key is available
        if (!process.env.GOOGLE_PLACES_API_KEY) {
            console.error('Google Places API key not found in environment variables');
            return null;
        }
        
        let finalPhotoReference = photoReference;
        
        // If we don't have a photoReference from Gemini, search for the place
        if (!finalPhotoReference || finalPhotoReference.trim() === '') {
            console.log('No photo reference provided, searching for place:', placeName);
            
            // Build search query
            const query = address ? `${placeName} ${address}` : placeName;
            
            // Step 1: Find place using Places API Text Search
            const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            console.log('Places search URL (without key):', searchUrl.replace(process.env.GOOGLE_PLACES_API_KEY, 'HIDDEN'));
            
            const searchResponse = await fetch(searchUrl);
            if (!searchResponse.ok) {
                console.error(`Places search failed: ${searchResponse.status} - ${searchResponse.statusText}`);
                throw new Error(`Places search failed: ${searchResponse.status}`);
            }
            
            const searchData = await searchResponse.json();
            console.log('Places search response status:', searchData.status);
            console.log('Places search results count:', searchData.results ? searchData.results.length : 0);
            
            if (searchData.results && searchData.results.length > 0) {
                const place = searchData.results[0];
                console.log('Found place:', place.name, 'Photos available:', place.photos ? place.photos.length : 0);
                
                // Get photo reference from search results
                if (place.photos && place.photos.length > 0) {
                    finalPhotoReference = place.photos[0].photo_reference;
                    console.log('Got photo reference:', finalPhotoReference ? 'YES' : 'NO');
                }
            } else {
                console.log('No places found in search results');
            }
        }
        
        // If we have a photo reference (either from Gemini or from search), fetch the image
        if (finalPhotoReference) {
            console.log('Fetching photo with reference:', finalPhotoReference.substring(0, 20) + '...');
            
            const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${finalPhotoReference}&key=${process.env.GOOGLE_PLACES_API_KEY}`;
            
            // Fetch with redirect following enabled (default in fetch)
            const imageResponse = await fetch(photoUrl, {
                method: 'GET',
                redirect: 'follow'  // Explicitly follow redirects
            });
            console.log('Photo fetch response status:', imageResponse.status);
            console.log('Photo fetch final URL:', imageResponse.url);
            
            if (imageResponse.ok) {
                const imageBuffer = await imageResponse.arrayBuffer();
                const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                console.log('Successfully converted photo to base64, size:', base64Image.length, 'chars');
                console.log('Content type:', contentType);
                return `data:${contentType};base64,${base64Image}`;
            } else {
                console.error('Photo fetch failed:', imageResponse.status, imageResponse.statusText);
                console.error('Response headers:', Object.fromEntries(imageResponse.headers.entries()));
            }
        } else {
            console.log('No photo reference available for:', placeName);
        }
        
        return null; // No photo found
    } catch (error) {
        console.error('Error searching for place photo:', error);
        return null; // Return null on error so frontend can use placeholder
    }
}
