// backend/app.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors'); // Required for cross-origin requests from frontend

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable JSON body parsing for POST requests

// Database Configuration
// IMPORTANT: Replace 'YOUR_NEON_DATABASE_CONNECTION_STRING' with your actual Neon connection string.
// It should look something like: 'postgresql://user:password@host:port/database?sslmode=require'
const pool = new Pool({
    connectionString:'postgresql://CSS_owner:npg_KdWbBSZm7zO4@ep-rapid-paper-a8c17feg-pooler.eastus2.azure.neon.tech/css?sslmode=require',
    ssl: {
        rejectUnauthorized: false // Use this if you encounter issues with SSL certificates (for development only)
    }
});

// Test DB connection
pool.connect()
    .then(client => {
        console.log('Connected to PostgreSQL database!');
        client.release();
    })
    .catch(err => {
        console.error('Error connecting to database:', err.stack);
    });

// --- API Endpoints ---

// Helper function to handle common GET logic
const getTableData = async (req, res, tableName) => {
    try {
        const result = await pool.query(`SELECT * FROM ${tableName}`);
        res.json(result.rows);
    } catch (err) {
        console.error(`Error fetching data from ${tableName}:`, err.stack);
        res.status(500).json({ error: `Internal server error when fetching ${tableName}` });
    }
};

// Helper function to handle common POST logic
const postTableData = async (req, res, tableName, columns) => {
    const values = columns.map(col => req.body[col]);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const columnNames = columns.join(', ');

    try {
        const queryText = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) RETURNING *`;
        const result = await pool.query(queryText, values);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(`Error inserting data into ${tableName}:`, err.stack);
        // Check for specific error codes (e.g., unique constraint violation)
        if (err.code === '23505') { // unique_violation
            res.status(409).json({ error: 'Duplicate entry detected. This record already exists.' });
        } else if (err.code === '23503') { // foreign_key_violation
            res.status(400).json({ error: 'Foreign key violation. One or more related IDs do not exist.' });
        } else if (err.code === '22P02' || err.code === '23502') { // invalid_text_representation, not_null_violation
            res.status(400).json({ error: 'Invalid or missing data for required fields. Please check your input.' });
        } else {
            res.status(500).json({ error: `Internal server error when inserting into ${tableName}` });
        }
    }
};


// 1. Customers
app.get('/api/customers', (req, res) => getTableData(req, res, 'Customers'));
app.post('/api/customers', (req, res) =>
    postTableData(req, res, 'Customers', ['customer_name', 'email', 'phone', 'address'])
);

// 2. Couriers
app.get('/api/couriers', (req, res) => getTableData(req, res, 'Couriers'));
app.post('/api/couriers', (req, res) =>
    postTableData(req, res, 'Couriers', ['courier_name', 'phone', 'email', 'hire_date'])
);

// 3. Packages
app.get('/api/packages', (req, res) => getTableData(req, res, 'Packages'));
app.post('/api/packages', (req, res) =>
    postTableData(req, res, 'Packages', ['weight_kg', 'dimensions_cm', 'description', 'declared_value', 'fragile'])
);

// 4. Locations
app.get('/api/locations', (req, res) => getTableData(req, res, 'Locations'));
app.post('/api/locations', (req, res) =>
    postTableData(req, res, 'Locations', ['address_line1', 'city', 'state', 'zip_code', 'country', 'location_type'])
);

// 5. ShipmentStatus
app.get('/api/shipment_status', (req, res) => getTableData(req, res, 'ShipmentStatus'));
app.post('/api/shipment_status', (req, res) =>
    postTableData(req, res, 'ShipmentStatus', ['status_name'])
);

// 6. Shipments
app.get('/api/shipments', (req, res) => getTableData(req, res, 'Shipments'));
app.post('/api/shipments', (req, res) =>
    postTableData(req, res, 'Shipments', [
        'customer_id', 'courier_id', 'package_id', 'origin_location_id',
        'destination_location_id', 'current_status_id', 'tracking_number',
        'shipment_date', 'estimated_delivery_date', 'actual_delivery_date'
    ])
);

// 7. PaymentMethods
app.get('/api/payment_methods', (req, res) => getTableData(req, res, 'PaymentMethods'));
app.post('/api/payment_methods', (req, res) =>
    postTableData(req, res, 'PaymentMethods', ['method_name'])
);

// 8. Payments
app.get('/api/payments', (req, res) => getTableData(req, res, 'Payments'));
app.post('/api/payments', (req, res) =>
    postTableData(req, res, 'Payments', ['shipment_id', 'method_id', 'amount', 'payment_date'])
);

// 9. Vehicles
app.get('/api/vehicles', (req, res) => getTableData(req, res, 'Vehicles'));
app.post('/api/vehicles', (req, res) =>
    postTableData(req, res, 'Vehicles', ['courier_id', 'make', 'model', 'license_plate', 'vehicle_type'])
);

// 10. DeliveryHistory
app.get('/api/delivery_history', (req, res) => getTableData(req, res, 'DeliveryHistory'));
app.post('/api/delivery_history', (req, res) =>
    postTableData(req, res, 'DeliveryHistory', [
        'shipment_id', 'status_id', 'timestamp', 'location_id', 'notes'
    ])
);

// --- Custom Report API (Level 1/3) ---
app.get('/api/report/shipment_summary', async (req, res) => {
    try {
        const query = `
            SELECT
                s.status_name,
                COUNT(sh.shipment_id) AS total_shipments,
                AVG(p.weight_kg) AS average_package_weight,
                SUM(py.amount) AS total_revenue
            FROM
                Shipments sh
            JOIN
                ShipmentStatus s ON sh.current_status_id = s.status_id
            JOIN
                Packages p ON sh.package_id = p.package_id
            LEFT JOIN -- Use LEFT JOIN to include shipments without payment yet
                Payments py ON sh.shipment_id = py.shipment_id
            GROUP BY
                s.status_name
            ORDER BY
                total_shipments DESC;
        `;
        const result = await pool.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching shipment summary report:', err.stack);
        res.status(500).json({ error: 'Internal server error when fetching shipment summary report' });
    }
});


// Start the server
app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
});
