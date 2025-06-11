// frontend/script.js

const API_BASE_URL = 'http://localhost:3000/api'; // Replace with your backend URL if different

/**
 * Displays a message box with the given text and color.
 * @param {string} message The message to display.
 * @param {string} type The type of message ('success', 'error', 'info').
 */
function showMessageBox(message, type) {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.style.display = 'block';
        messageBox.style.backgroundColor = ''; // Reset background color

        switch (type) {
            case 'success':
                messageBox.style.backgroundColor = '#4CAF50'; // Green
                break;
            case 'error':
                messageBox.style.backgroundColor = '#f44336'; // Red
                break;
            case 'info':
                messageBox.style.backgroundColor = '#2196F3'; // Blue
                break;
            default:
                messageBox.style.backgroundColor = '#333'; // Default dark
        }

        setTimeout(() => {
            messageBox.style.display = 'none';
        }, 3000); // Hide after 3 seconds
    }
}

/**
 * Fetches data from a given API endpoint.
 * @param {string} endpoint The API endpoint (e.g., 'customers').
 * @returns {Promise<Array>} A promise that resolves to an array of data.
 */
async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        showMessageBox(`Failed to fetch ${endpoint}: ${error.message}`, 'error');
        return [];
    }
}

/**
 * Posts data to a given API endpoint.
 * @param {string} endpoint The API endpoint (e.g., 'customers').
 * @param {Object} data The data object to send.
 * @returns {Promise<Object>} A promise that resolves to the created data object.
 */
async function postData(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const responseData = await response.json();

        if (!response.ok) {
            throw new Error(responseData.error || `HTTP error! status: ${response.status}`);
        }

        showMessageBox(`Successfully added new record to ${endpoint}!`, 'success');
        return responseData;
    } catch (error) {
        console.error(`Error posting to ${endpoint}:`, error);
        showMessageBox(`Failed to add record to ${endpoint}: ${error.message}`, 'error');
        return null;
    }
}

/**
 * Populates a table with data.
 * @param {string} tableId The ID of the table to populate.
 * @param {Array<Object>} data The array of data objects.
 * @param {Array<string>} headers The array of header keys to display.
 */
function populateTable(tableId, data, headers) {
    const tableBody = document.querySelector(`#${tableId} tbody`);
    if (!tableBody) return; // Exit if table body not found

    tableBody.innerHTML = ''; // Clear existing rows

    if (data.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = headers.length;
        cell.textContent = 'No data available.';
        cell.className = 'text-center py-4 text-gray-500';
        return;
    }

    data.forEach(item => {
        const row = tableBody.insertRow();
        headers.forEach(headerKey => {
            const cell = row.insertCell();
            let value = item[headerKey] !== null && item[headerKey] !== undefined ? item[headerKey] : 'N/A';

            // Format dates
            if (headerKey.includes('date') || headerKey.includes('timestamp')) {
                if (value !== 'N/A') {
                    try {
                        const date = new Date(value);
                        // Check if the date is valid before formatting
                        if (!isNaN(date.getTime())) {
                            value = date.toLocaleString(); // Or toLocaleDateString() for date only
                        } else {
                            value = 'Invalid Date';
                        }
                    } catch (e) {
                        value = 'Invalid Date';
                    }
                }
            } else if (typeof value === 'boolean') {
                value = value ? 'Yes' : 'No';
            } else if (typeof value === 'number' && headerKey.includes('amount')) {
                 value = `$${parseFloat(value).toFixed(2)}`;
            } else if (typeof value === 'number' && headerKey.includes('weight_kg')) {
                 value = `${parseFloat(value).toFixed(2)} kg`;
            } else if (typeof value === 'number' && headerKey.includes('declared_value')) {
                 value = `$${parseFloat(value).toFixed(2)}`;
            }


            cell.textContent = value;
        });
    });
}

/**
 * Handles form submissions to add new data.
 * @param {string} formId The ID of the form.
 * @param {string} endpoint The API endpoint to post to.
 * @param {Function} refreshTableFunction The function to call to refresh the table after successful post.
 * @param {Array<string>} booleanFields Optional: Array of field names that are booleans and need special handling.
 */
function setupFormSubmission(formId, endpoint, refreshTableFunction, booleanFields = []) {
    const form = document.getElementById(formId);
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const data = {};

        for (const [key, value] of formData.entries()) {
            if (booleanFields.includes(key)) {
                // For checkboxes, FormData.entries() only includes them if checked.
                // If not checked, set to false manually.
                data[key] = form.querySelector(`[name="${key}"]`).checked;
            } else if (form.querySelector(`[name="${key}"]`).type === 'number') {
                data[key] = value === '' ? null : parseFloat(value); // Convert to number or null
            } else if (form.querySelector(`[name="${key}"]`).type === 'date') {
                data[key] = value === '' ? null : value; // Keep as string for date
            } else if (form.querySelector(`[name="${key}"]`).type === 'datetime-local') {
                data[key] = value === '' ? null : value + ':00'; // Append seconds for TIMESTAMP type
            }
            else {
                data[key] = value === '' ? null : value; // Set empty strings to null
            }
        }

        const result = await postData(endpoint, data);
        if (result) {
            form.reset(); // Clear form fields
            refreshTableFunction(); // Refresh the table
        }
    });
}


// --- Specific Page Load Functions ---

// Dashboard Page
async function loadDashboard() {
    const reportData = await fetchData('report/shipment_summary');
    if (reportData.length > 0) {
        populateTable(
            'reportTable',
            reportData,
            ['status_name', 'total_shipments', 'average_package_weight', 'total_revenue']
        );
        drawShipmentStatusChart(reportData);
    } else {
        document.getElementById('reportTable').querySelector('tbody').innerHTML = '<tr><td colspan="4" class="text-center py-4 text-gray-500">No report data available.</td></tr>';
        document.getElementById('data-visualization').innerHTML = '<h2 class="text-2xl font-bold mb-4 text-white">Data Visualization: Shipments by Status</h2><p class="text-center text-gray-500">No data to display chart.</p>';
    }
}

// Draw Shipment Status Chart
function drawShipmentStatusChart(reportData) {
    const ctx = document.getElementById('shipmentStatusChart');
    if (!ctx) return;

    const labels = reportData.map(row => row.status_name);
    const data = reportData.map(row => row.total_shipments);
    const colors = [
        'rgba(100, 100, 100, 0.8)', // Grey
        'rgba(150, 150, 150, 0.8)', // Light Grey
        'rgba(200, 200, 200, 0.8)', // Lighter Grey
        'rgba(70, 70, 70, 0.8)',   // Darker Grey
        'rgba(120, 120, 120, 0.8)',
        'rgba(170, 170, 170, 0.8)',
        'rgba(50, 50, 50, 0.8)',
        'rgba(90, 90, 90, 0.8)',
        'rgba(140, 140, 140, 0.8)',
        'rgba(190, 190, 190, 0.8)'
    ];

    new Chart(ctx, {
        type: 'pie', // Using pie chart for status distribution
        data: {
            labels: labels,
            datasets: [{
                label: 'Number of Shipments',
                data: data,
                backgroundColor: colors.slice(0, labels.length), // Use enough colors
                borderColor: '#1a1a1a', // Body background color
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#f0f0f0' // Legend text color
                    }
                },
                title: {
                    display: true,
                    text: 'Shipments by Status',
                    color: '#ffffff' // Title text color
                }
            }
        }
    });
}

// Customers Page
async function loadCustomers() {
    const customers = await fetchData('customers');
    populateTable(
        'customersTable',
        customers,
        ['customer_id', 'customer_name', 'email', 'phone', 'address']
    );
    setupFormSubmission('addCustomerForm', 'customers', loadCustomers);
}

// Couriers Page
async function loadCouriers() {
    const couriers = await fetchData('couriers');
    populateTable(
        'couriersTable',
        couriers,
        ['courier_id', 'courier_name', 'phone', 'email', 'hire_date']
    );
    setupFormSubmission('addCourierForm', 'couriers', loadCouriers);
}

// Packages Page
async function loadPackages() {
    const packages = await fetchData('packages');
    populateTable(
        'packagesTable',
        packages,
        ['package_id', 'weight_kg', 'dimensions_cm', 'description', 'declared_value', 'fragile']
    );
    setupFormSubmission('addPackageForm', 'packages', loadPackages, ['fragile']);
}

// Locations Page
async function loadLocations() {
    const locations = await fetchData('locations');
    populateTable(
        'locationsTable',
        locations,
        ['location_id', 'address_line1', 'city', 'state', 'zip_code', 'country', 'location_type']
    );
    setupFormSubmission('addLocationForm', 'locations', loadLocations);
}

// Shipment Statuses Page
async function loadShipmentStatuses() {
    const statuses = await fetchData('shipment_status');
    populateTable(
        'shipmentStatusesTable',
        statuses,
        ['status_id', 'status_name']
    );
    setupFormSubmission('addShipmentStatusForm', 'shipment_status', loadShipmentStatuses);
}

// Shipments Page
async function loadShipments() {
    const shipments = await fetchData('shipments');
    populateTable(
        'shipmentsTable',
        shipments,
        ['shipment_id', 'customer_id', 'courier_id', 'package_id', 'origin_location_id',
         'destination_location_id', 'current_status_id', 'tracking_number',
         'shipment_date', 'estimated_delivery_date', 'actual_delivery_date']
    );
    setupFormSubmission('addShipmentForm', 'shipments', loadShipments);
}

// Payment Methods Page
async function loadPaymentMethods() {
    const methods = await fetchData('payment_methods');
    populateTable(
        'paymentMethodsTable',
        methods,
        ['method_id', 'method_name']
    );
    setupFormSubmission('addPaymentMethodForm', 'payment_methods', loadPaymentMethods);
}

// Payments Page
async function loadPayments() {
    const payments = await fetchData('payments');
    populateTable(
        'paymentsTable',
        payments,
        ['payment_id', 'shipment_id', 'method_id', 'amount', 'payment_date']
    );
    setupFormSubmission('addPaymentForm', 'payments', loadPayments);
}

// Vehicles Page
async function loadVehicles() {
    const vehicles = await fetchData('vehicles');
    populateTable(
        'vehiclesTable',
        vehicles,
        ['vehicle_id', 'courier_id', 'make', 'model', 'license_plate', 'vehicle_type']
    );
    setupFormSubmission('addVehicleForm', 'vehicles', loadVehicles);
}

// Delivery History Page
async function loadDeliveryHistory() {
    const history = await fetchData('delivery_history');
    populateTable(
        'deliveryHistoryTable',
        history,
        ['history_id', 'shipment_id', 'status_id', 'timestamp', 'location_id', 'notes']
    );
    setupFormSubmission('addDeliveryHistoryForm', 'delivery_history', loadDeliveryHistory);
}

// --- Initialize based on current page ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('customers.html')) {
        loadCustomers();
    } else if (path.includes('couriers.html')) {
        loadCouriers();
    } else if (path.includes('packages.html')) {
        loadPackages();
    } else if (path.includes('locations.html')) {
        loadLocations();
    } else if (path.includes('shipment_statuses.html')) {
        loadShipmentStatuses();
    } else if (path.includes('shipments.html')) {
        loadShipments();
    } else if (path.includes('payment_methods.html')) {
        loadPaymentMethods();
    } else if (path.includes('payments.html')) {
        loadPayments();
    } else if (path.includes('vehicles.html')) {
        loadVehicles();
    } else if (path.includes('delivery_history.html')) {
        loadDeliveryHistory();
    } else { // Default to dashboard if no specific page matched (e.g., index.html or root)
        loadDashboard();
    }
});
