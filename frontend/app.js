const API_BASE = '/api';

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

async function loadClients() {
    const clients = await fetchJSON(`${API_BASE}/clients`);
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
        fragment.querySelector('.complete-delivery').dataset.id = delivery.id;
        fragment.querySelector('.complete-delivery').addEventListener('click', () => completeDelivery(delivery.id));
        tbody.appendChild(fragment);
    });
}

async function loadSummary() {
    const summary = await fetchJSON(`${API_BASE}/metrics/summary`);
    document.querySelector('#summaryClients').textContent = summary.totals.clients;
    document.querySelector('#summaryDeliveries').textContent = summary.totals.deliveries;
    document.querySelector('#summaryToday').textContent = summary.totals.completed_today;
    renderBarChart('breadsChart', summary.breads_by_day.map((item) => ({
        label: item.day,
        value: item.breads,
    })));
}

async function generateRoute() {
    const date = document.querySelector('#routeDate').value;
    const startLat = Number(document.querySelector('#startLat').value) || undefined;
    const startLon = Number(document.querySelector('#startLon').value) || undefined;
    const payload = { date };
    if (!Number.isNaN(startLat)) payload.start_latitude = startLat;
    if (!Number.isNaN(startLon)) payload.start_longitude = startLon;
    const route = await fetchJSON(`${API_BASE}/routes`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
    const list = document.querySelector('#routeList');
    list.innerHTML = '';
    route.forEach((stop, index) => {
        const item = document.createElement('li');
        item.innerHTML = `<strong>${index + 1}. ${stop.name}</strong><br><small>${stop.address || ''}</small>`;
        list.appendChild(item);
    });
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
        await Promise.all([loadDeliveries(), loadSummary()]);
    });

    document.getElementById('refreshClients').addEventListener('click', loadClients);
    document.getElementById('refreshDeliveries').addEventListener('click', loadDeliveries);
    document.getElementById('generateRoute').addEventListener('click', generateRoute);
    document.getElementById('routeDate').addEventListener('change', () => {
        loadDeliveries();
        generateRoute();
    });

    registerServiceWorker();
    setupInstallPrompt();

    loadClients();
    loadDeliveries();
    loadSummary();
});
