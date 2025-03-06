const express = require('express');
const router = express.Router();
const { postgresPool } = require('../config/db'); // Assuming you are using a PostgreSQL pool

// Endpoint to fetch monthly carbon emissions
router.get('/monthly', async (req, res) => {
    try {
        const result = await postgresPool.query(`
            SELECT
                project_id,
                DATE_TRUNC('month', recorded_at) AS month,
                SUM(emission_value) AS total_emissions
            FROM emissions
            GROUP BY project_id, month
            ORDER BY month;
        `);
        res.json(result.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.get('/total', async (req, res) => {
    try {
        const totalResult = await postgresPool.query(`
            SELECT
                SUM(emission_value) AS total_emissions,
                (SELECT SUM(emission_value)
                 FROM emissions
                 WHERE recorded_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                 AND recorded_at < DATE_TRUNC('month', CURRENT_DATE)) AS last_month_emissions
            FROM emissions
        `);

        const { total_emissions, last_month_emissions } = totalResult.rows[0];
        console.log(total_emissions);
        console.log(last_month_emissions);

        const growthPercentage = last_month_emissions
            ? ((total_emissions - last_month_emissions) / last_month_emissions * 100).toFixed(2)
            : 0;

        res.json({
            totalEmissions: parseFloat(total_emissions).toFixed(2),
            growthPercentage: parseFloat(growthPercentage)
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
