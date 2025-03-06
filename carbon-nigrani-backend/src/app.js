const fs = require('fs');
const cors = require('cors');
const dotenv = require('dotenv');
const csv = require('csv-parser');
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { connectMongoDB, connectPostgres } = require('./config/db');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5001;
const PG_PORT = process.env.PG_PORT || 5432;

// Connect to DB
connectMongoDB();
const postgresPool = connectPostgres();

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());
app.use(bodyParser.json());
app.use(cookieParser());

// Load carbon stocks from JSON file
const carbonStocks = JSON.parse(fs.readFileSync('carbon_stocks.json', 'utf8'));

// Load emission factors from CSV file
let emissionFactors = [];
fs.createReadStream('emission_factors.csv')
  .pipe(csv())
  .on('data', (row) => {
    emissionFactors.push(row);
  })
  .on('end', () => {
    console.log('CSV file successfully processed');
  });

// Routes
const authRoutes = require('./routes/authRoutes');
const calculateRoutes = require('./routes/calculateRoutes');
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const emissionRoutes = require("./routes/emissionRoutes");
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/calculate', calculateRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/emissions", emissionRoutes);

// Utility functions for calculations
const calculateUndergroundEmissions = (data) => {
    const { rawCoalProduction, emissionFactor, conversionFactor } = data;
    return rawCoalProduction * emissionFactor * conversionFactor;
  };

  const calculatePostMiningEmissions = (data) => {
    const { undergroundCoalProduction, postMiningEmissionFactor, conversionFactor } = data;
    return undergroundCoalProduction * postMiningEmissionFactor * conversionFactor;
  };

  const calculateSurfaceEmissions = (data) => {
    const { surfaceCoalProduction, emissionFactor, conversionFactor } = data;
    return surfaceCoalProduction * emissionFactor * conversionFactor;
  };

  const calculateAbandonedEmissions = (data) => {
    const { numberOfAbandonedMines, fractionOfGassyMines, emissionFactor, conversionFactor } = data;
    return numberOfAbandonedMines * fractionOfGassyMines * emissionFactor * conversionFactor;
  };


  const calculateAdjustedEmissions = (data) => {
    const { miningEmissions, postMiningEmissions, methaneRecovered } = data;
    return (miningEmissions + postMiningEmissions) - methaneRecovered;
  };

  // Function to get state-wise carbon sink value
  const getStatewiseCarbonSink = (state) => {
    const carbonPools = carbonStocks[state];
    if (!carbonPools) return 0;

    const { AGB, BGB, DeadWood, Litter, SOC } = carbonPools;
    return ((AGB + BGB + DeadWood + Litter + SOC)*1000) ;

  // IF co2 equivalent is needed rather than carbon stock
        // const { co2Equivalent} = carbonPools;
        // return co2Equivalent;
  };

  // Function to get emission factor and conversion factor based on mine type, raw coal production, and depth of mining
const getFactors = (mineType, rawCoalProduction, depthOfMining) => {
    const factor = emissionFactors.find(
      (ef) => ef['IPCC 2006 Source/Sink Category'].includes(mineType) && ef['Raw Coal Production'] === rawCoalProduction && ef['Depth of Mining'] === depthOfMining
    );
    return factor ? { emissionFactor: parseFloat(factor['Value']), conversionFactor: parseFloat(factor['Conversion Factor']) || 1 } : { emissionFactor: 0, conversionFactor: 0 };
  };

  // Function to get post-mining emission factor based on depth of mining
const getPostMiningEmissionFactor = (depthOfMining) => {
    if (depthOfMining < 200) {
      return 0.9;
    } else if (depthOfMining > 400) {
      return 4.0;
    } else {
      return 2.5;
    }
  };

  app.post('/api/calculate-emissions', (req, res) => {
    const data = req.body;
    let totalEmissions = 0;
    let miningEmissions = 0;
    let postMiningEmissions = 0;


    if (data.mineType === 'underground') {
      const { emissionFactor, conversionFactor } = getFactors('underground', data.rawCoalProduction, data.depthOfMining);
      miningEmissions = calculateUndergroundEmissions({ ...data, emissionFactor, conversionFactor });
      if (data.postMining) {
        const postMiningEmissionFactor = getPostMiningEmissionFactor(data.depthOfMining);
        postMiningEmissions = calculatePostMiningEmissions({ ...data, postMiningEmissionFactor, conversionFactor });
      }
      totalEmissions = miningEmissions + postMiningEmissions;
      if (data.AdjustedEmissions) {
        totalEmissions = calculateAdjustedEmissions({ miningEmissions, postMiningEmissions, methaneRecovered: data.methaneRecovered });
      }

    } else if (data.mineType === 'surface') {
      const { emissionFactor, conversionFactor } = getFactors('surface', data.rawCoalProduction, data.depthOfMining);
      miningEmissions = calculateSurfaceEmissions({ ...data, emissionFactor,conversionFactor });

      totalEmissions = miningEmissions ;

      if (data.AdjustedEmissions) {
        totalEmissions = calculateAdjustedEmissions({ miningEmissions, postMiningEmissions, methaneRecovered: data.methaneRecovered });
      }

    } else if (data.mineType === 'abandoned') {
      const { emissionFactor, conversionFactor } = getFactors('abandoned', data.timePeriod);
      miningEmissions = calculateAbandonedEmissions({ ...data, emissionFactor, conversionFactor });
      totalEmissions = miningEmissions;
    }

    // Convert excavation and transportation emissions to the same units as mine emissions
    const excavationEmissions = parseFloat(data.excavationEmissions || 0)/1000 // * 0.67e-6;  Convert to Gg  if needed or divide by 1000 to convert to Tons
    const transportationEmissions = parseFloat(data.transportationEmissions || 0)/1000 //  * 0.67e-6;  Convert to Gg needed

    // Add emissions from excavation and transportation
    const TotalEmission = totalEmissions + excavationEmissions + transportationEmissions;



    // Get state-wise carbon sink value
    const carbonSink = getStatewiseCarbonSink(data.location);



    // Perform gap analysis using the state-wise carbon sink value
    const gap = TotalEmission - carbonSink;

    // Convert methane emissions to CO₂ equivalent
    const co2Equivalent = gap * 28; // Using GWP of 28 for methane



    res.json({ TotalEmission, carbonSink, gap, co2Equivalent });
  });


// Example MongoDB route
app.get('/api/mongo-test', async (req, res) => {
    res.send('MongoDB connected successfully!');
});

// Example PostgreSQL route
  app.get('/api/postgres-test', async (req, res) => {
    try {
      const result = await postgresPool.query('SELECT NOW()');
      res.json({ success: true, time: result.rows[0] });
    } catch (err) {
        console.error('Error during database query:', err.stack);
      res.status(500).json({ success: false, error: err.message });
    }
  });

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
