const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };
const MAP_LOAD_TIMEOUT = 15000;

function parseCoordinate(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function getLatLng(position) {
    if (!position) return null;
    if (typeof position.lat === 'function' && typeof position.lng === 'function') {
        return { lat: position.lat(), lng: position.lng() };
    }
    if (typeof position.lat === 'number' && typeof position.lng === 'number') {
        return { lat: position.lat, lng: position.lng };
    }
    return null;
}

function formatCoordinate(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
    }
    return value.toFixed(6);
}

function waitForGoogleMaps(timeout = MAP_LOAD_TIMEOUT) {
    return new Promise((resolve, reject) => {
        if (window.google?.maps?.places) {
            resolve(window.google.maps);
            return;
        }

        if (window.__googleMapsLoadError) {
            reject(new Error('O SDK do Google Maps não pôde ser carregado.'));
            return;
        }

        const callbacks = Array.isArray(window.__googleMapsCallbacks)
            ? window.__googleMapsCallbacks
            : (window.__googleMapsCallbacks = []);

        const timer = window.setTimeout(() => {
            reject(new Error('Tempo limite ao carregar o Google Maps.'));
        }, timeout);

        const handleReady = () => {
            window.clearTimeout(timer);
            if (window.google?.maps) {
                if (!window.google.maps.places) {
                    reject(new Error('Biblioteca Places não disponível.'));
                    return;
                }
                resolve(window.google.maps);
            } else {
                reject(new Error('Google Maps não disponível.'));
            }
        };

        if (window.__googleMapsLoaded && window.google?.maps) {
            handleReady();
            return;
        }

        callbacks.push(handleReady);
    });
}

function updateCoordinateInputs(latitudeInput, longitudeInput, position) {
    const latLng = getLatLng(position);
    if (!latLng) return;
    if (latitudeInput) {
        latitudeInput.value = formatCoordinate(latLng.lat);
    }
    if (longitudeInput) {
        longitudeInput.value = formatCoordinate(latLng.lng);
    }
}

function showStatusMessage(element, message, type = 'info') {
    if (!element) return;
    element.hidden = !message;
    if (!message) {
        element.textContent = '';
        element.classList.remove('error');
        return;
    }
    element.textContent = message;
    element.classList.toggle('error', type === 'error');
}

function pickInitialPosition(latitudeInput, longitudeInput, defaultCenter) {
    const lat = parseCoordinate(latitudeInput?.value);
    const lng = parseCoordinate(longitudeInput?.value);
    if (lat != null && lng != null) {
        return { lat, lng };
    }
    return { ...DEFAULT_CENTER, ...defaultCenter };
}

export function createClientMapPicker(options = {}) {
    const {
        mapElement,
        wrapperElement,
        triggerElement,
        addressInput,
        latitudeInput,
        longitudeInput,
        statusElement,
        defaultCenter = DEFAULT_CENTER,
    } = options;

    if (!mapElement || !addressInput || !latitudeInput || !longitudeInput) {
        return null;
    }

    let googleMaps;
    let mapInstance;
    let marker;
    let autocomplete;
    let hasAttemptedLoad = false;

    const revealMap = () => {
        if (wrapperElement) {
            wrapperElement.hidden = false;
        }
        mapElement.hidden = false;
        if (mapInstance && googleMaps?.event) {
            window.requestAnimationFrame(() => {
                googleMaps.event.trigger(mapInstance, 'resize');
                if (marker?.getPosition) {
                    mapInstance.setCenter(marker.getPosition());
                }
            });
        }
    };

    const syncMarkerFromInputs = () => {
        if (!marker || !mapInstance) return;
        const lat = parseCoordinate(latitudeInput.value);
        const lng = parseCoordinate(longitudeInput.value);
        if (lat == null || lng == null) return;
        const position = { lat, lng };
        marker.setPosition(position);
        mapInstance.panTo(position);
    };

    const ensureMap = async () => {
        if (mapInstance) {
            return mapInstance;
        }
        try {
            googleMaps = await waitForGoogleMaps();
        } catch (error) {
            showStatusMessage(statusElement, error.message, 'error');
            throw error;
        }
        showStatusMessage(statusElement, '');
        const startPosition = pickInitialPosition(latitudeInput, longitudeInput, defaultCenter);
        mapInstance = new googleMaps.Map(mapElement, {
            center: startPosition,
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
        });
        marker = new googleMaps.Marker({
            position: startPosition,
            draggable: true,
            map: mapInstance,
        });
        marker.addListener('dragend', () => {
            updateCoordinateInputs(latitudeInput, longitudeInput, marker.getPosition());
        });
        mapInstance.addListener('click', (event) => {
            if (!event.latLng) return;
            marker.setPosition(event.latLng);
            updateCoordinateInputs(latitudeInput, longitudeInput, event.latLng);
        });
        latitudeInput.addEventListener('change', syncMarkerFromInputs);
        longitudeInput.addEventListener('change', syncMarkerFromInputs);
        latitudeInput.addEventListener('blur', syncMarkerFromInputs);
        longitudeInput.addEventListener('blur', syncMarkerFromInputs);
        if (!autocomplete) {
            autocomplete = new googleMaps.places.Autocomplete(addressInput, {
                fields: ['formatted_address', 'geometry', 'name'],
                types: ['geocode'],
            });
            autocomplete.addListener('place_changed', async () => {
                const place = autocomplete.getPlace();
                if (!place || !place.geometry || !place.geometry.location) {
                    return;
                }
                try {
                    await ensureMap();
                } catch (error) {
                    showStatusMessage(statusElement, error.message, 'error');
                    return;
                }
                updateCoordinateInputs(latitudeInput, longitudeInput, place.geometry.location);
                revealMap();
                marker.setPosition(place.geometry.location);
                mapInstance.setZoom(16);
                mapInstance.panTo(place.geometry.location);
                if (!addressInput.value && place.formatted_address) {
                    addressInput.value = place.formatted_address;
                }
            });
        }
        return mapInstance;
    };

    const openMap = async () => {
        hasAttemptedLoad = true;
        try {
            await ensureMap();
            revealMap();
        } catch (error) {
            showStatusMessage(statusElement, error.message, 'error');
        }
    };

    if (triggerElement) {
        triggerElement.addEventListener('click', (event) => {
            event.preventDefault();
            openMap();
        });
    }

    addressInput.addEventListener('focus', () => {
        if (!hasAttemptedLoad) {
            openMap();
        }
    });

    if (statusElement && window.__googleMapsLoadError) {
        showStatusMessage(
            statusElement,
            'Não foi possível carregar o Google Maps. Verifique a chave configurada no index.html.',
            'error',
        );
    }

    return {
        open: openMap,
        reset() {
            if (wrapperElement) {
                wrapperElement.hidden = true;
            }
            mapElement.hidden = false;
            if (marker && mapInstance) {
                const fallback = pickInitialPosition(latitudeInput, longitudeInput, defaultCenter);
                marker.setPosition(fallback);
                mapInstance.setCenter(fallback);
                mapInstance.setZoom(14);
            }
        },
        syncMarkerFromInputs,
    };
}
