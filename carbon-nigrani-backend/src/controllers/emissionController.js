//emissionController.js

const csv = require('csv-parser');
const fs = require('fs');

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
    return carbonStocks[state] || 0; // Default to 0 if state not found
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


exports.emission = async (req, res) => {
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
      if (data.methaneUtilization) {
        totalEmissions = miningEmissions + postMiningEmissions - (data.methaneRecovered  * 0.67e-6);
      }

    } else if (data.mineType === 'surface') {
      const { emissionFactor, conversionFactor } = getFactors('surface', data.rawCoalProduction, data.depthOfMining);
      miningEmissions = calculateSurfaceEmissions({ ...data, emissionFactor, conversionFactor });

      totalEmissions = miningEmissions ;
      if (data.methaneUtilization) {
        totalEmissions = miningEmissions - (data.methaneRecovered  * 0.67e-6);
      }
    } else if (data.mineType === 'abandoned') {
      const { emissionFactor, conversionFactor } = getFactors('abandoned', data.timePeriod);
      miningEmissions = calculateAbandonedEmissions({ ...data, emissionFactor, conversionFactor });
      totalEmissions = miningEmissions;
    }

    // Convert excavation and transportation emissions to the same units as mine emissions
    const excavationEmissions = parseFloat(data.excavationEmissions || 0) * 0.67e-6; // Convert to Gg
    const transportationEmissions = parseFloat(data.transportationEmissions || 0) * 0.67e-6; // Convert to Gg

    // Add emissions from excavation and transportation
    const TotalEmission = totalEmissions + excavationEmissions + transportationEmissions;



    // Get state-wise carbon sink value
    const carbonSink = getStatewiseCarbonSink(data.location);

    // Perform gap analysis using the state-wise carbon sink value
    const gap = TotalEmission - carbonSink;

    // Convert methane emissions to CO₂ equivalent
    const co2Equivalent = TotalEmission * 25; // Using GWP of 25 for methane

    res.json({ TotalEmission, carbonSink, gap, co2Equivalent });
};
