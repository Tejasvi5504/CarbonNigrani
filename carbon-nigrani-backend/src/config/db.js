const mongoose = require('mongoose');
const { Pool } = require('pg');

const connectMongoDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');
    } catch (error) {
        console.error(`MongoDB connection error: ${error.message}`);
        process.exit(1);
    }
};

// const postgresPool = new Pool({
//     // host: process.env.POSTGRES_HOST,
//     // port: process.env.POSTGRES_PORT,
//     // user: process.env.POSTGRES_USER,
//     // password: process.env.POSTGRES_PASSWORD,  // Ensure this is passed correctly
//     // database: process.env.POSTGRES_DATABASE,
//     host: 'localhost',
//     port: 5432,
//     user: 'sarth',
//     password: 'postgres',
//     database: 'carbon_nigrani',
// });

const postgresPool = new Pool({
connectionString: 'postgres://postgres:postgres@localhost:5432/carbon_nigrani',
});

let isPostgresConnected = false;
const connectPostgres = () => {
    if (!isPostgresConnected) {
        postgresPool.on('connect', () => {
            console.log('PostgreSQL connected');
            isPostgresConnected = true;
        });

        postgresPool.on('error', (err) => {
            console.error('PostgreSQL error:', err.stack);
            process.exit(1);
        });
    }
    return postgresPool;
};

module.exports = { connectMongoDB, connectPostgres, postgresPool };
