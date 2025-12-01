// App State Management
class DaddyApp {
    constructor() {
        this.state = {
            show_options: false,
            ui_mode: 'form', // 'form' or 'results'
            currentUser: this.loadUserData(),
            displayedPlaces: [], // Track shown places for exclusion
            lastSearchParams: {} // Store search criteria for "Show more"
        };
        
        this.initializeApp();
    }

    // Initialize the app
    initializeApp() {
        this.bindEvents();
        this.loadUserDataToForm();
        this.updateUI();
        this.attemptAutoLocation();
    }

    // Load user data from localStorage
    loadUserData() {
        return {
            kids_ages: localStorage.getItem('daddy_app_kids_ages') || '',
            home_location: localStorage.getItem('daddy_app_home_location') || ''
        };
    }

    // Save user data to localStorage
    saveUserData() {
        var agesInput = document.getElementById('agesInput');
        var locationInput = document.getElementById('locationInput');
        
        this.state.currentUser.kids_ages = agesInput.value;
        this.state.currentUser.home_location = locationInput.value;
        
        localStorage.setItem('daddy_app_kids_ages', this.state.currentUser.kids_ages);
        localStorage.setItem('daddy_app_home_location', this.state.currentUser.home_location);
    }

    // Load saved user data into form inputs
    loadUserDataToForm() {
        document.getElementById('agesInput').value = this.state.currentUser.kids_ages;
        document.getElementById('locationInput').value = this.state.currentUser.home_location;
    }

    // Bind all event listeners
    bindEvents() {
        var self = this;
        
        // More options toggle
        document.getElementById('moreOptionsToggle').addEventListener('click', function() {
            self.toggleMoreOptions();
        });

        // Get ideas button (form mode)
        document.getElementById('getIdeasBtn').addEventListener('click', function() {
            self.handleGetIdeas();
        });

        // Start over button (results mode)
        document.getElementById('startOverBtn').addEventListener('click', function() {
            self.handleStartOver();
        });

        // Show more button (results mode) 
        document.getElementById('showMoreBtn').addEventListener('click', function() {
            self.handleShowMore();
        });
    }

    // Toggle more options visibility
    toggleMoreOptions() {
        this.state.show_options = !this.state.show_options;
        this.updateMoreOptionsUI();
    }

    // Update more options UI based on state
    updateMoreOptionsUI() {
        var optionalFilters = document.getElementById('optionalFilters');
        var moreOptionsText = document.getElementById('moreOptionsText');
        var caret = document.getElementById('moreOptionsCaret');

        if (this.state.show_options) {
            optionalFilters.classList.add('show');
            moreOptionsText.textContent = 'Hide options';
            caret.classList.add('rotated');
        } else {
            optionalFilters.classList.remove('show');
            moreOptionsText.textContent = 'More options';
            caret.classList.remove('rotated');
        }
    }

    // Validate form inputs
    validateForm() {
        var agesInput = document.getElementById('agesInput');
        var locationInput = document.getElementById('locationInput');
        var agesError = document.getElementById('agesError');
        var locationError = document.getElementById('locationError');

        var isValid = true;

        // Clear previous errors
        agesError.textContent = '';
        locationError.textContent = '';

        // Validate ages
        if (!agesInput.value.trim()) {
            agesError.textContent = 'Please enter your kids\' ages';
            isValid = false;
        }

        // Validate location
        if (!locationInput.value.trim()) {
            locationError.textContent = 'Please enter a location';
            isValid = false;
        }

        return isValid;
    }

    // Handle "Get ideas" button click
    handleGetIdeas() {
        var self = this;
        
        if (!this.validateForm()) {
            return;
        }

        // Save user data
        this.saveUserData();

        // Switch to results mode
        this.state.ui_mode = 'results';
        this.updateUI();

        // Scroll to results
        this.scrollToResults();

        // Perform search
        setTimeout(function() {
            self.performSearch();
        }, 100);
    }

    // Handle "Start over" button click
    handleStartOver() {
        // Reset state
        this.state.ui_mode = 'form';
        this.state.displayedPlaces = [];
        this.state.lastSearchParams = {};
        
        // Update UI
        this.updateUI();
        
        // Scroll to form
        this.scrollToForm();
    }

    // Handle "Show more" button click
    handleShowMore() {
        this.performSearch(true); // Pass true to indicate "show more" mode
    }

    // Update UI based on current state
    updateUI() {
        var floatingActionBar = document.getElementById('floatingActionBar');
        var resultsSection = document.getElementById('resultsSection');

        if (this.state.ui_mode === 'form') {
            // Form mode: hide floating bar and results
            floatingActionBar.classList.add('hidden');
            resultsSection.classList.add('hidden');
        } else {
            // Results mode: show results section but keep floating bar hidden until results load
            resultsSection.classList.remove('hidden');
            // Note: floating bar will be shown in displayResults() after successful load
        }

        this.updateMoreOptionsUI();
    }

    // Scroll to results section
    scrollToResults() {
        setTimeout(function() {
            document.getElementById('resultsSection').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }

    // Scroll to form section
    scrollToForm() {
        setTimeout(function() {
            document.getElementById('formSection').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }, 100);
    }


    // Perform search by calling Gemini API directly
    performSearch(isShowMore) {
        var self = this;
        
        // Store search params for "show more"
        if (!isShowMore) {
            this.state.lastSearchParams = {
                ages: document.getElementById('agesInput').value,
                location: document.getElementById('locationInput').value,
                indoorOutdoor: document.getElementById('indoorOutdoor').value,
                costPreference: document.getElementById('costPreference').value,
                timeAvailable: document.getElementById('timeAvailable').value,
                distance: document.getElementById('distance').value
            };
            this.state.displayedPlaces = [];
        }
        
        if (isShowMore) {
            this.showMoreLoadingState();
        } else {
            this.showLoadingState();
        }

        // Use stored params for "show more" or current form data for new search
        var requestData = isShowMore ? this.state.lastSearchParams : {
            ages: document.getElementById('agesInput').value,
            location: document.getElementById('locationInput').value,
            indoorOutdoor: document.getElementById('indoorOutdoor').value,
            costPreference: document.getElementById('costPreference').value,
            timeAvailable: document.getElementById('timeAvailable').value,
            distance: document.getElementById('distance').value
        };

        // For "Show more", add list of already displayed places to exclude
        if (isShowMore && this.state.displayedPlaces.length > 0) {
            requestData.excludePlaces = this.state.displayedPlaces;
        }

        // Call serverless function for recommendations
        this.callRecommendationsAPI(requestData)
        .then(function(results) {
            if (results && results.length > 0) {
                self.displayResults(results, isShowMore);
            } else {
                if (isShowMore) {
                    self.hideMoreLoadingState();
                } else {
                    self.showNoResults();
                }
            }
        })
        .catch(function(error) {
            console.error('Search error:', error);
            if (isShowMore) {
                self.hideMoreLoadingState();
            } else {
                self.showNoResults();
            }
        });
    }

    // Call recommendations API using serverless function
    callRecommendationsAPI(requestData) {
        return fetch('https://www.heydaddy.io/api/getRecommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Recommendations API error: ' + response.status + ' - ' + response.statusText);
            }
            return response.json();
        })
        .then(function(results) {
            console.log('Recommendations API response:', results);
            return Array.isArray(results) ? results : [results];
        });
    }

    // Show loading state
    showLoadingState() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('resultsGrid').classList.add('hidden');
        document.getElementById('noResultsState').classList.add('hidden');
        
        // Start the fun loading messages
        this.startLoadingMessages();
    }

    // Start rotating fun loading messages
    startLoadingMessages() {
        var messages = [
            'Finding great places for your family',
            'Discovering fun adventures nearby',
            'Searching for kid-friendly spots',
            'Looking for the perfect family outing',
            'Finding awesome places to explore'
        ];
        
        var loadingText = document.getElementById('loadingText');
        var currentIndex = 0;
        
        // Clear any existing interval
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
        }
        
        // Set initial message
        loadingText.innerHTML = messages[0] + '<span class="loading-dots"></span>';
        
        // Rotate messages every 2 seconds
        this.loadingInterval = setInterval(function() {
            currentIndex = (currentIndex + 1) % messages.length;
            loadingText.innerHTML = messages[currentIndex] + '<span class="loading-dots"></span>';
        }, 2000);
    }

    // Stop loading messages
    stopLoadingMessages() {
        if (this.loadingInterval) {
            clearInterval(this.loadingInterval);
            this.loadingInterval = null;
        }
    }

    // Show loading state for "Show More"
    showMoreLoadingState() {
        var resultsGrid = document.getElementById('resultsGrid');
        
        // Create loading indicator for "Show More" 
        var moreLoadingDiv = document.createElement('div');
        moreLoadingDiv.id = 'moreLoadingState';
        moreLoadingDiv.className = 'loading-state';
        moreLoadingDiv.innerHTML = '<div class="spinner"></div><p>Loading more places<span class="loading-dots"></span></p>';
        
        resultsGrid.appendChild(moreLoadingDiv);
        
        // Scroll to the loading indicator so user can see it's working
        setTimeout(function() {
            moreLoadingDiv.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);
    }

    // Hide loading state for "Show More"
    hideMoreLoadingState() {
        var moreLoadingState = document.getElementById('moreLoadingState');
        if (moreLoadingState) {
            moreLoadingState.remove();
        }
    }

    // Show no results state
    showNoResults() {
        this.stopLoadingMessages();
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('resultsGrid').classList.add('hidden');
        document.getElementById('noResultsState').classList.remove('hidden');
    }

    // Display search results
    displayResults(results, isShowMore) {
        var self = this;
        
        if (isShowMore) {
            this.hideMoreLoadingState();
        } else {
            this.stopLoadingMessages();
            document.getElementById('loadingState').classList.add('hidden');
        }
        
        document.getElementById('noResultsState').classList.add('hidden');
        document.getElementById('resultsGrid').classList.remove('hidden');

        var resultsGrid = document.getElementById('resultsGrid');
        
        // Clear existing results only for new searches, not for "Show More"
        if (!isShowMore) {
            resultsGrid.innerHTML = '';
            this.state.displayedPlaces = [];
        }

        // Filter out duplicates and add new results
        var newResults = [];
        for (var i = 0; i < results.length; i++) {
            var place = results[i];
            var isDuplicate = false;
            
            // Check if this place is already displayed
            for (var j = 0; j < this.state.displayedPlaces.length; j++) {
                if (this.state.displayedPlaces[j].place_id === place.place_id || 
                    this.state.displayedPlaces[j].name === place.name) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                newResults.push(place);
                this.state.displayedPlaces.push(place);
            }
        }

        // Add new place cards
        for (var i = 0; i < newResults.length; i++) {
            var place = newResults[i];
            var card = self.createPlaceCard(place);
            resultsGrid.appendChild(card);
        }

        // Show floating action bar now that results are displayed
        document.getElementById('floatingActionBar').classList.remove('hidden');

        // Scroll to results for new searches, or scroll to new content for "Show More"
        if (isShowMore) {
            // Scroll to the new results area
            var newCards = resultsGrid.querySelectorAll('.place-card');
            if (newCards.length > 5) {
                newCards[newCards.length - newResults.length].scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        } else {
            this.scrollToResults();
        }
    }

    // Create a place card element
    createPlaceCard(place) {
        var self = this;
        var card = document.createElement('div');
        card.className = 'place-card';
        card.setAttribute('tabindex', '0'); // Make it keyboard accessible
        
        var clickHandler = function() {
            self.openGoogleMaps(place);
        };
        
        card.addEventListener('click', clickHandler);
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                clickHandler();
            }
        });

        // Start with placeholder and search for photo using Google Places API
        var imageElement = '<div class="place-image-placeholder">📍</div>';

        var rating = place.rating 
            ? '<div class="place-rating">★ ' + place.rating.toFixed(1) + '</div>'
            : '';

        var description = place.description || '';

        card.innerHTML = imageElement +
            '<div class="place-content">' +
                '<div class="place-header">' +
                    '<div class="place-name">' + place.name + '</div>' +
                    rating +
                '</div>' +
                (description ? '<div class="place-description">' + description + '</div>' : '') +
            '</div>';

        // Search for photo using Google Places API after card is created
        this.searchForPlacePhoto(place.name, place.address, card, undefined);

        return card;
    }

    // Search for place photo using serverless function
    searchForPlacePhoto(placeName, placeAddress, cardElement, photoReference) {
        var self = this;

        // Always use serverless function to avoid CORS issues
        // Pass photoReference if we have it from Gemini to save API calls
        fetch('https://www.heydaddy.io/api/getRecommendations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'searchPhoto',
                placeName: placeName,
                address: placeAddress,
                photoReference: photoReference || null
            })
        })
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Photo search failed: ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            if (data.photoUrl) {
                self.updatePlaceCardWithPhoto(cardElement, placeName, data.photoUrl);
            } else {
                console.log('No photo found for:', placeName);
                // Keep placeholder
            }
        })
        .catch(function(error) {
            console.log('Photo search failed for:', placeName, error);
            // Keep placeholder on error
        });
    }

    // Try using a placeholder image service as fallback
    tryPlaceholderImage(cardElement, placeName) {
        // Use a generic placeholder service that might work better
        var placeholderUrl = 'https://via.placeholder.com/400x200/e1e8ed/666666?text=' + encodeURIComponent(placeName.substring(0, 20));
        this.updatePlaceCardWithPhoto(cardElement, placeName, placeholderUrl);
    }

    // Update place card with photo URL (from serverless function)
    updatePlaceCardWithPhoto(cardElement, placeName, photoUrl) {
        var placeholder = cardElement.querySelector('.place-image-placeholder');
        
        if (placeholder && photoUrl) {
            var img = document.createElement('img');
            img.alt = placeName;
            img.className = 'place-image';
            img.loading = 'lazy';
            img.style.maxWidth = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';
            
            // Set onload/onerror handlers before setting src
            img.onload = function() {
                placeholder.style.display = 'none';
                cardElement.insertBefore(img, cardElement.firstChild);
            };
            
            img.onerror = function() {
                // Keep placeholder on error
            };
            
            img.src = photoUrl;
            
            // Handle Base64 images that load synchronously
            setTimeout(function() {
                if (img.complete && img.naturalWidth > 0) {
                    placeholder.style.display = 'none';
                    cardElement.insertBefore(img, cardElement.firstChild);
                }
            }, 10);
            
            // Force display after 100ms if not already shown
            setTimeout(function() {
                if (cardElement.querySelector('.place-image-placeholder').style.display !== 'none') {
                    try {
                        // Validate Base64 data
                        var base64Data = photoUrl.split(',')[1];
                        atob(base64Data);
                        
                        // Force display
                        placeholder.style.display = 'none';
                        cardElement.insertBefore(img, cardElement.firstChild);
                        
                    } catch(e) {
                        // Fallback to CSS background
                        var bgDiv = document.createElement('div');
                        bgDiv.className = 'place-image';
                        bgDiv.style.backgroundImage = 'url(' + photoUrl + ')';
                        bgDiv.style.backgroundSize = 'cover';
                        bgDiv.style.backgroundPosition = 'center';
                        bgDiv.style.width = '100%';
                        bgDiv.style.height = '200px';
                        bgDiv.style.display = 'block';
                        
                        placeholder.style.display = 'none';
                        cardElement.insertBefore(bgDiv, cardElement.firstChild);
                    }
                }
            }, 100);
        }
    }

    // Get Google Maps API key for photos
    getGoogleMapsApiKey() {
        // This will be set as a global variable or from environment
        return 'AIzaSyDr4zafXO0Y5zx681q8f3XKwtRdCJ3H42I';
    }

    // Attempt to automatically detect and fill user's current location
    attemptAutoLocation() {
        var self = this;
        var locationInput = document.getElementById('locationInput');
        
        // Only attempt auto-location if field is empty and we haven't stored a location
        if (locationInput.value || this.state.currentUser.home_location) {
            return;
        }
        
        // Check if geolocation is supported
        if (!navigator.geolocation) {
            console.log('Geolocation not supported by this browser');
            return;
        }
        
        // Show loading state in location input
        var originalPlaceholder = locationInput.placeholder;
        locationInput.placeholder = 'Detecting location...';
        locationInput.disabled = true;
        
        // Get current position
        navigator.geolocation.getCurrentPosition(
            function(position) {
                // Success - get coordinates and reverse geocode
                self.reverseGeocode(position.coords.latitude, position.coords.longitude)
                .then(function(zipCode) {
                    if (zipCode) {
                        locationInput.value = zipCode;
                        self.state.currentUser.home_location = zipCode;
                        localStorage.setItem('daddy_app_home_location', zipCode);
                    }
                })
                .catch(function(error) {
                    console.log('Reverse geocoding failed:', error);
                })
                .finally(function() {
                    // Restore input state
                    locationInput.placeholder = originalPlaceholder;
                    locationInput.disabled = false;
                });
            },
            function(error) {
                // Error getting location
                console.log('Geolocation error:', error.message);
                
                // Restore input state
                locationInput.placeholder = originalPlaceholder;
                locationInput.disabled = false;
            },
            {
                timeout: 10000,
                maximumAge: 300000, // 5 minutes
                enableHighAccuracy: false
            }
        );
    }

    // Reverse geocode coordinates to get zip code
    reverseGeocode(lat, lng) {
        return fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.getGoogleMapsApiKey()}`)
        .then(function(response) {
            if (!response.ok) {
                throw new Error('Geocoding API error: ' + response.status);
            }
            return response.json();
        })
        .then(function(data) {
            if (data.results && data.results.length > 0) {
                // Extract zip code from address components
                var addressComponents = data.results[0].address_components;
                for (var i = 0; i < addressComponents.length; i++) {
                    var component = addressComponents[i];
                    if (component.types.includes('postal_code')) {
                        return component.long_name;
                    }
                }
                
                // Fallback: try to extract from formatted_address
                var address = data.results[0].formatted_address;
                var zipMatch = address.match(/\b\d{5}(?:-\d{4})?\b/);
                if (zipMatch) {
                    return zipMatch[0];
                }
                
                // If no zip code, use city, state format
                var city = '';
                var state = '';
                for (var i = 0; i < addressComponents.length; i++) {
                    var component = addressComponents[i];
                    if (component.types.includes('locality')) {
                        city = component.long_name;
                    } else if (component.types.includes('administrative_area_level_1')) {
                        state = component.short_name;
                    }
                }
                
                if (city && state) {
                    return city + ', ' + state;
                }
            }
            
            throw new Error('No address found');
        });
    }

    // Open Google Maps for a specific place using search API format
    openGoogleMaps(place) {
        // Use user's exact format: https://www.google.com/maps/search/?api=1&query=[name] [address]
        var query = place.name + ' ' + place.address;
        var mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query);
        window.open(mapsUrl, '_self');
    }
}

// Initialize the app when DOM is loaded
var app;
document.addEventListener('DOMContentLoaded', function() {
    app = new DaddyApp();
});
