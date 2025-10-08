const API_BASE = '/api';
const DEFAULT_START = { latitude: -23.55052, longitude: -46.633308 };
const STOP_POLL_INTERVAL = 20000;

let map;
let markersLayer;
let routeLayer;
let stopLayer;
const markerByClientId = new Map();
const checkboxByClientId = new Map();
let cachedClients = [];
const selectedClientIds = new Set();
let hasAutoSelectedClients = false;
let routeUpdateTimeout;
let stopPollTimer;
let pendingStopEvents = [];

async function fetchJSON(url, options = {}) {
    const response = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Erro na requisição');
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
}

function serializeForm(form) {
    const data = new FormData(form);
    const payload = {};
    data.forEach((value, key) => {
        if (value === '') {
            payload[key] = null;
            return;
        }
        if (['latitude', 'longitude', 'quantity'].includes(key)) {
            payload[key] = value === null ? null : Number(value);
        } else {
            payload[key] = value;
        }
    });
    return payload;
}

function formatDistance(meters) {
    if (meters == null) return '---';
    const value = Number(meters);
    if (Number.isNaN(value)) return '---';
    if (value < 1000) {
        return `${value.toFixed(0)} m`;
    }
    return `${(value / 1000).toFixed(2)} km`;
}

function formatDuration(seconds) {
    if (seconds == null) return '-';
    const value = Number(seconds);
    if (Number.isNaN(value) || value < 0) return '-';
    const minutes = Math.floor(value / 60);
    if (minutes === 0) {
        return `${value.toFixed(0)} s`;
    }
    const remaining = value % 60;
    if (minutes < 60) {
        return `${minutes} min${remaining >= 30 ? ' e 30 s' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
}

function initMap() {
    const mapContainer = document.getElementById('map');
    if (!mapContainer || typeof L === 'undefined') {
        return;
    }
    if (map) {
        return;
    }
    map = L.map('map', { zoomControl: true });
    map.setView([DEFAULT_START.latitude, DEFAULT_START.longitude], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contribuidores',
        maxZoom: 19,
    }).addTo(map);
    markersLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    stopLayer = L.layerGroup().addTo(map);
}

function getMarkerStyle(clientId) {
    const isSelected = selectedClientIds.has(Number(clientId));
    if (isSelected) {
        return {
            radius: 10,
            color: '#f97316',
            weight: 3,
            fillColor: '#fb923c',
            fillOpacity: 0.85,
        };
    }
    return {
        radius: 8,
        color: '#2563eb',
        weight: 2,
        fillColor: '#3b82f6',
        fillOpacity: 0.75,
    };
}

function updateMarkerStyle(clientId) {
    const marker = markerByClientId.get(Number(clientId));
    if (!marker) return;
    marker.setStyle(getMarkerStyle(clientId));
}

function updateSelectionCount() {
    const counter = document.getElementById('selectedCount');
    if (counter) {
        counter.textContent = selectedClientIds.size;
    }
}

function highlightRouteOption(clientId, isSelected) {
    const checkbox = checkboxByClientId.get(Number(clientId));
    if (!checkbox) return;
    const wrapper = checkbox.closest('.route-option');
    if (wrapper) {
        wrapper.classList.toggle('active', isSelected);
    }
    if (checkbox.checked !== isSelected) {
        checkbox.checked = isSelected;
    }
}

function scheduleRouteUpdate() {
    clearTimeout(routeUpdateTimeout);
    routeUpdateTimeout = setTimeout(() => {
        generateRoute();
    }, 200);
}

function setClientSelection(rawClientId, isSelected) {
    const clientId = Number(rawClientId);
    if (Number.isNaN(clientId)) return;
    if (isSelected) {
        selectedClientIds.add(clientId);
    } else {
        selectedClientIds.delete(clientId);
    }
    highlightRouteOption(clientId, isSelected);
    updateMarkerStyle(clientId);
    updateSelectionCount();
    scheduleRouteUpdate();
}

function renderRouteClients(clients) {
    const container = document.getElementById('routeClients');
    if (!container) return;
    container.innerHTML = '';
    checkboxByClientId.clear();

    clients.forEach((client) => {
        const clientId = Number(client.id);
        if (Number.isNaN(clientId)) return;
        const option = document.createElement('label');
        option.className = 'route-option';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = clientId;
        const isSelected = selectedClientIds.has(clientId);
        checkbox.checked = isSelected;
        checkbox.addEventListener('change', (event) => {
            setClientSelection(clientId, event.target.checked);
        });
        option.appendChild(checkbox);

        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = client.name;
        const subtitle = document.createElement('small');
        subtitle.textContent = client.address || 'Sem endereço cadastrado';
        info.appendChild(title);
        info.appendChild(subtitle);
        option.appendChild(info);

        option.classList.toggle('active', isSelected);
        option.addEventListener('click', (event) => {
            if (event.target.tagName === 'INPUT') return;
            const newValue = !checkbox.checked;
            checkbox.checked = newValue;
            setClientSelection(clientId, newValue);
        });

        checkboxByClientId.set(clientId, checkbox);
        container.appendChild(option);
    });

    updateSelectionCount();
}

function renderClientsOnMap(clients) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    markerByClientId.clear();
    const bounds = [];

    clients.forEach((client) => {
        if (client.latitude == null || client.longitude == null) return;
        const lat = Number(client.latitude);
        const lon = Number(client.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        const marker = L.circleMarker([lat, lon], getMarkerStyle(client.id));
        marker.bindPopup(
            `<strong>${client.name}</strong><br>${client.address || ''}`,
        );
        marker.on('click', () => {
            const isSelected = selectedClientIds.has(Number(client.id));
            setClientSelection(client.id, !isSelected);
        });
        marker.addTo(markersLayer);
        markerByClientId.set(Number(client.id), marker);
        bounds.push([lat, lon]);
    });

    if (bounds.length) {
        const boundsLayer = L.latLngBounds(bounds);
        map.fitBounds(boundsLayer, { padding: [24, 24] });
    } else {
        map.setView([DEFAULT_START.latitude, DEFAULT_START.longitude], 11);
    }
}

function selectIdealClients(count) {
    const parsedCount = Number(count);
    if (Number.isNaN(parsedCount) || parsedCount <= 0) return;
    const idealClients = cachedClients
        .filter((client) => (client.name || '').toLowerCase().includes('ideal'))
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    idealClients.forEach((client, index) => {
        const clientId = Number(client.id);
        if (Number.isNaN(clientId)) return;
        setClientSelection(clientId, index < parsedCount);
    });
}

function drawRouteOnMap(stops, start) {
    if (!map || !routeLayer) return;
    routeLayer.clearLayers();
    markerByClientId.forEach((marker) => marker.unbindTooltip());

    if (!Array.isArray(stops) || stops.length === 0) {
        if (start && start.latitude != null && start.longitude != null) {
            map.setView([Number(start.latitude), Number(start.longitude)], 13);
        }
        return;
    }

    const path = [];
    if (start && start.latitude != null && start.longitude != null) {
        const startLat = Number(start.latitude);
        const startLon = Number(start.longitude);
        if (!Number.isNaN(startLat) && !Number.isNaN(startLon)) {
            path.push([startLat, startLon]);
        }
    }

    stops.forEach((stop, index) => {
        if (stop.latitude == null || stop.longitude == null) return;
        const lat = Number(stop.latitude);
        const lon = Number(stop.longitude);
        if (Number.isNaN(lat) || Number.isNaN(lon)) return;
        path.push([lat, lon]);
        const marker = markerByClientId.get(Number(stop.client_id || stop.id));
        if (marker) {
            marker.bindTooltip(`${index + 1}º · ${stop.client_name || stop.name}`, {
                direction: 'top',
                permanent: false,
            });
        }
    });

    if (path.length >= 2) {
        const polyline = L.polyline(path, {
            color: '#22c55e',
            weight: 4,
            opacity: 0.75,
            dashArray: '6,8',
        });
        routeLayer.addLayer(polyline);
        map.fitBounds(polyline.getBounds(), { padding: [32, 32] });
    } else if (path.length === 1) {
        map.setView(path[0], 13);
    }
}

function showRouteWarnings(skipped) {
    const container = document.getElementById('routeWarnings');
    if (!container) return;
    if (!skipped || skipped.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    const list = document.createElement('ul');
    skipped.forEach((client) => {
        const item = document.createElement('li');
        item.textContent = client.client_name || client.name;
        list.appendChild(item);
    });
    container.innerHTML = '';
    const title = document.createElement('strong');
    title.textContent = 'Sem coordenadas para:';
    container.appendChild(title);
    container.appendChild(list);
    container.style.display = 'block';
}

function focusStopOnMap(event) {
    if (!map || !stopLayer) return;
    stopLayer.clearLayers();
    const lat = Number(event.position_latitude ?? event.latitude);
    const lon = Number(event.position_longitude ?? event.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return;
    const highlight = L.circleMarker([lat, lon], {
        radius: 14,
        color: '#facc15',
        weight: 3,
        fillColor: '#fde047',
        fillOpacity: 0.6,
    });
    highlight.addTo(stopLayer);
    map.setView([lat, lon], 16);
    if (event.client_id && markerByClientId.has(Number(event.client_id))) {
        markerByClientId.get(Number(event.client_id)).openPopup();
    }
}

function renderStopEvents(events) {
    const container = document.getElementById('stopAlerts');
    const badge = document.getElementById('stopAlertBadge');
    if (!container) return;
    pendingStopEvents = Array.isArray(events) ? events : [];
    container.innerHTML = '';

    if (!pendingStopEvents.length) {
        container.classList.remove('has-items');
        if (badge) badge.textContent = '0';
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Nenhuma parada detectada.';
        container.appendChild(empty);
        if (stopLayer) stopLayer.clearLayers();
        return;
    }

    container.classList.add('has-items');
    if (badge) badge.textContent = String(pendingStopEvents.length);

    pendingStopEvents.forEach((event) => {
        const card = document.createElement('article');
        card.className = 'stop-card';

        const title = document.createElement('h4');
        title.textContent = event.client_name || 'Cliente não identificado';
        card.appendChild(title);

        const meta = document.createElement('p');
        meta.className = 'stop-card__meta';
        const distanceLabel = formatDistance(event.distance_m);
        const durationLabel = formatDuration(event.duration_seconds);
        meta.textContent = `${distanceLabel} do cliente • parado há ${durationLabel}`;
        card.appendChild(meta);

        if (event.client_address) {
            const address = document.createElement('p');
            address.className = 'stop-card__address';
            address.textContent = event.client_address;
            card.appendChild(address);
        }

        if (event.triggered_at) {
            const triggered = document.createElement('small');
            const triggeredDate = new Date(event.triggered_at.replace(' ', 'T'));
            triggered.textContent = `Detectado às ${triggeredDate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
            })}`;
            card.appendChild(triggered);
        }

        const actions = document.createElement('div');
        actions.className = 'stop-card__actions';

        const confirmBtn = document.createElement('button');
        confirmBtn.type = 'button';
        confirmBtn.textContent = 'Registrar entrega';
        confirmBtn.addEventListener('click', () => ackStopEvent(event.id, true));
        actions.appendChild(confirmBtn);

        const skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'secondary';
        skipBtn.textContent = 'Ignorar parada';
        skipBtn.addEventListener('click', () => ackStopEvent(event.id, false));
        actions.appendChild(skipBtn);

        const focusBtn = document.createElement('button');
        focusBtn.type = 'button';
        focusBtn.className = 'ghost';
        focusBtn.textContent = 'Ver no mapa';
        focusBtn.addEventListener('click', () => focusStopOnMap(event));
        actions.appendChild(focusBtn);

        card.appendChild(actions);
        container.appendChild(card);
    });
}

async function loadStopEvents() {
    const response = await fetchJSON(`${API_BASE}/driver/stops?status=pending`);
    renderStopEvents(response.events || []);
    return response.events;
}

async function ackStopEvent(eventId, delivered) {
    const payload = { delivered };
    if (delivered) {
        const quantity = prompt('Quantos pães foram deixados neste ponto?');
        if (quantity === null) return;
        const parsed = Number(quantity);
        if (!Number.isFinite(parsed) || parsed < 0) {
            alert('Informe um número válido de pães.');
            return;
        }
        payload.quantity = parsed;
        const notes = prompt('Alguma observação adicional? (opcional)');
        if (notes) payload.notes = notes;
    }
    await fetchJSON(`${API_BASE}/driver/stops/${eventId}/ack`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    await Promise.all([loadStopEvents(), loadSummary(), loadDeliveries(), generateRoute()]);
}

function startStopPolling() {
    clearInterval(stopPollTimer);
    loadStopEvents();
    stopPollTimer = setInterval(loadStopEvents, STOP_POLL_INTERVAL);
}

async function loadClients() {
    const clients = await fetchJSON(`${API_BASE}/clients`);
    cachedClients = clients;

    const tbody = document.querySelector('#clientsTable tbody');
    const select = document.querySelector('#deliveryClient');
    tbody.innerHTML = '';
    select.innerHTML = '<option value="">Selecione...</option>';

    clients.forEach((client) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${client.name}</td>
            <td>${client.phone || ''}</td>
            <td>${client.address || ''}</td>
            <td>${client.latitude ?? ''}</td>
            <td>${client.longitude ?? ''}</td>
        `;
        tbody.appendChild(row);

        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        select.appendChild(option);
    });

    if (!hasAutoSelectedClients && clients.length) {
        const withCoordinates = clients.filter(
            (client) => client.latitude != null && client.longitude != null,
        );
        const initialSelection = withCoordinates.length ? withCoordinates : clients;
        initialSelection.forEach((client) => {
            const clientId = Number(client.id);
            if (!Number.isNaN(clientId)) {
                selectedClientIds.add(clientId);
            }
        });
        hasAutoSelectedClients = true;
    }

    clients.forEach((client) => {
        const clientId = Number(client.id);
        if (Number.isNaN(clientId)) return;
        if (
            !selectedClientIds.has(clientId)
            && (client.name || '').toLowerCase().includes('ideal')
        ) {
            selectedClientIds.add(clientId);
        }
    });

    renderRouteClients(clients);
    renderClientsOnMap(clients);
    return clients;
}

async function loadDeliveries() {
    const dateInput = document.querySelector('#routeDate');
    const params = dateInput.value ? `?date=${dateInput.value}` : '';
    const deliveries = await fetchJSON(`${API_BASE}/deliveries${params}`);
    const tbody = document.querySelector('#deliveriesTable tbody');
    const template = document.querySelector('#deliveryRowTemplate');
    tbody.innerHTML = '';

    deliveries.forEach((delivery) => {
        const fragment = template.content.cloneNode(true);
        fragment.querySelector('.client-name').textContent = delivery.client_name || delivery.client_id;
        fragment.querySelector('.delivery-date').textContent = delivery.scheduled_date;
        fragment.querySelector('.delivery-status').textContent = delivery.status;
        fragment.querySelector('.delivery-quantity').textContent = delivery.quantity ?? '-';
        fragment
            .querySelector('.complete-delivery')
            .addEventListener('click', () => completeDelivery(delivery.id));
        tbody.appendChild(fragment);
    });
}

async function loadSummary() {
    const summary = await fetchJSON(`${API_BASE}/metrics/summary`);
    document.querySelector('#summaryClients').textContent = summary.totals.clients;
    document.querySelector('#summaryDeliveries').textContent = summary.totals.deliveries;
    document.querySelector('#summaryToday').textContent = summary.totals.completed_today;
    if (summary.stops) {
        const pending = document.querySelector('#summaryPendingStops');
        const triggeredToday = document.querySelector('#summaryStopsToday');
        const deliveredToday = document.querySelector('#summaryStopsDelivered');
        if (pending) pending.textContent = summary.stops.pending;
        if (triggeredToday) triggeredToday.textContent = summary.stops.triggered_today;
        if (deliveredToday) deliveredToday.textContent = summary.stops.delivered_today;
    }
    renderBarChart(
        'breadsChart',
        summary.breads_by_day.map((item) => ({
            label: item.day,
            value: item.breads,
        })),
    );
}

async function generateRoute() {
    const list = document.querySelector('#routeList');
    if (!list) return;
    const warnings = document.getElementById('routeWarnings');
    if (warnings) warnings.textContent = '';
    if (list) list.innerHTML = '';

    const dateValue = document.querySelector('#routeDate').value;
    const startLatValue = document.querySelector('#startLat').value;
    const startLonValue = document.querySelector('#startLon').value;

    const payload = {};
    if (dateValue) payload.date = dateValue;
    if (startLatValue !== '') {
        const parsedLat = Number(startLatValue);
        if (!Number.isNaN(parsedLat)) payload.start_latitude = parsedLat;
    }
    if (startLonValue !== '') {
        const parsedLon = Number(startLonValue);
        if (!Number.isNaN(parsedLon)) payload.start_longitude = parsedLon;
    }
    const clientIds = Array.from(selectedClientIds);
    if (clientIds.length) payload.client_ids = clientIds;

    try {
        const route = await fetchJSON(`${API_BASE}/routes`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        if (Array.isArray(route.ordered) && route.ordered.length) {
            route.ordered.forEach((stop, index) => {
                const item = document.createElement('li');
                const title = document.createElement('strong');
                title.textContent = `${index + 1}. ${stop.client_name || stop.name}`;
                const subtitle = document.createElement('small');
                subtitle.textContent = stop.address || 'Sem endereço informado';
                item.appendChild(title);
                item.appendChild(subtitle);
                if (stop.scheduled_date) {
                    const meta = document.createElement('small');
                    meta.textContent = `Agendado: ${stop.scheduled_date}`;
                    item.appendChild(document.createElement('br'));
                    item.appendChild(meta);
                }
                list.appendChild(item);
            });
        } else {
            const empty = document.createElement('li');
            empty.textContent = 'Cadastre latitude e longitude para gerar uma rota.';
            list.appendChild(empty);
        }

        drawRouteOnMap(route.ordered || [], route.start || DEFAULT_START);
        showRouteWarnings(route.skipped || []);
    } catch (error) {
        const item = document.createElement('li');
        item.textContent = `Erro ao gerar rota: ${error.message}`;
        list.appendChild(item);
        showRouteWarnings([]);
    }
}

async function completeDelivery(id) {
    const quantity = prompt('Quantos pães foram entregues?');
    if (quantity === null) return;
    const notes = prompt('Observações adicionais? (opcional)') || undefined;
    await fetchJSON(`${API_BASE}/deliveries/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ quantity: Number(quantity), notes }),
    });
    await Promise.all([loadDeliveries(), loadSummary(), generateRoute()]);
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js');
    }
}

function setupInstallPrompt() {
    let deferredPrompt;
    const button = document.getElementById('installButton');
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        button.style.display = 'inline-flex';
    });
    button.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            button.textContent = 'Instalado';
        }
        deferredPrompt = null;
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();

    const clientForm = document.getElementById('clientForm');
    clientForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = serializeForm(clientForm);
        await fetchJSON(`${API_BASE}/clients`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        clientForm.reset();
        await loadClients();
        await generateRoute();
    });

    const deliveryForm = document.getElementById('deliveryForm');
    deliveryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const payload = serializeForm(deliveryForm);
        await fetchJSON(`${API_BASE}/deliveries`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        deliveryForm.reset();
        await Promise.all([loadDeliveries(), loadSummary(), generateRoute()]);
    });

    document.getElementById('refreshClients').addEventListener('click', async () => {
        await loadClients();
        await generateRoute();
    });

    document.getElementById('refreshDeliveries').addEventListener('click', loadDeliveries);
    document.getElementById('generateRoute').addEventListener('click', generateRoute);
    document.getElementById('routeDate').addEventListener('change', () => {
        loadDeliveries();
        generateRoute();
    });

    document.getElementById('selectIdeal').addEventListener('click', () => {
        const countInput = document.getElementById('idealCount');
        const count = Number(countInput.value) || 3;
        selectIdealClients(count);
    });

    const refreshStops = document.getElementById('refreshStops');
    if (refreshStops) {
        refreshStops.addEventListener('click', () => {
            loadStopEvents();
        });
    }

    registerServiceWorker();
    setupInstallPrompt();

    loadClients().then(() => generateRoute());
    loadDeliveries();
    loadSummary();
    startStopPolling();
});
