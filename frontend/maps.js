const DEFAULT_CENTER = { lat: -23.55052, lng: -46.633308 };
const MAP_LOAD_TIMEOUT = 15000;

let googleMapsPromise = null;
let configPromise = null;

async function fetchConfig() {
    if (!configPromise) {
        configPromise = fetch('/api/config')
            .then((response) => {
                if (!response.ok) {
                    throw new Error('Não foi possível carregar a configuração do mapa.');
                }
                return response.json();
            })
            .catch((error) => {
                configPromise = null;
                throw error;
            });
    }
    return configPromise;
}

function injectGoogleMapsScript(apiKey, libraries = ['places', 'geometry']) {
    return new Promise((resolve, reject) => {
        if (!apiKey) {
            reject(new Error('Configure a variável GOOGLE_MAPS_API_KEY para usar o mapa.'));
            return;
        }

        if (document.querySelector('script[data-google-maps-sdk]')) {
            resolve();
            return;
        }

        const script = document.createElement('script');
        const params = new URLSearchParams({
            key: apiKey,
            libraries: libraries.join(','),
        });
        script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
        script.async = true;
        script.defer = true;
        script.setAttribute('data-google-maps-sdk', 'true');
        script.addEventListener('error', () => {
            script.remove();
            reject(new Error('Erro ao carregar o SDK do Google Maps.'));
        });
        script.addEventListener('load', () => {
            resolve();
        });
        document.head.appendChild(script);
    });
}

export async function ensureGoogleMaps() {
    if (window.google?.maps?.Map) {
        return window.google.maps;
    }
    if (!googleMapsPromise) {
        googleMapsPromise = (async () => {
            const config = await fetchConfig();
            await injectGoogleMapsScript(config.google_maps_api_key);
            return waitForGoogleMaps();
        })().catch((error) => {
            googleMapsPromise = null;
            throw error;
        });
    }
    return googleMapsPromise;
}

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

        const start = Date.now();
        const check = () => {
            if (window.google?.maps?.places) {
                resolve(window.google.maps);
            } else if (Date.now() - start > timeout) {
                reject(new Error('Tempo limite ao carregar o Google Maps.'));
            } else {
                window.requestAnimationFrame(check);
            }
        };
        check();
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
            googleMaps = await ensureGoogleMaps();
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
