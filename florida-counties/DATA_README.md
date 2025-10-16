# Florida Counties Labor Statistics Map - Data Guide

## Overview

This project integrates Bureau of Labor Statistics (BLS) Occupational Employment and Wage Statistics (OEWS) data with state-level employment projections to visualize labor market information for Florida counties.

## Directory Structure

```
florida-counties/
├── data/
│   ├── raw/
│   │   ├── oews/           # Raw OEWS MSA data (CSV files)
│   │   │   ├── oews_fl_msa_2023.csv
│   │   │   └── cbsa-county-crosswalk.csv
│   │   └── emp/            # Raw employment projections data
│   │       └── projections_fl.csv
│   ├── intermediate/       # Processed ETL outputs
│   │   ├── cbsa-county-crosswalk.json
│   │   ├── oews_fl_county_2023.json
│   │   └── projections_fl.json
├── public/data/           # Client-accessible data files
│   ├── soc-map.json
│   ├── oews_fl_county_2023.json
│   └── projections_fl.json
├── scripts/               # ETL processing scripts
│   ├── build-cbsa-crosswalk.ts
│   ├── build-oews-county.ts
│   └── build-projections.ts
├── src/
│   ├── data/
│   │   └── soc-map.json   # SOC code mappings
│   └── lib/
│       ├── types.ts       # TypeScript type definitions
│       └── data-loaders.ts # Data loading utilities
└── app/api/bls/          # BLS API proxy endpoint
    └── route.ts
```

## Data Sources

### 1. OEWS Data (County-Level)
- **Source**: BLS OEWS (via MSA data + CBSA crosswalk)
- **File**: `data/raw/oews/oews_fl_msa_<year>.csv`
- **Contains**: Employment counts, mean/median wages by SOC code
- **Geography**: Metropolitan Statistical Areas (MSAs) → Counties

### 2. CBSA-County Crosswalk
- **Source**: Census Bureau
- **File**: `data/raw/oews/cbsa-county-crosswalk.csv`
- **Purpose**: Map MSA-level data to individual counties
- **Note**: Uses equal allocation weights when not specified

### 3. State Projections
- **Source**: Florida Department of Economic Opportunity / State Workforce Agency
- **File**: `data/raw/emp/projections_fl.csv`
- **Contains**: 10-year employment projections, growth rates, annual openings
- **Geography**: State-level (Florida)

### 4. SOC Code Mappings
- **File**: `src/data/soc-map.json`
- **Purpose**: Canonical mapping of training programs to SOC codes
- **Categories**: Allied Health, Trades, Nursing, Veterinary

## ETL Pipeline

### Running ETL Scripts

```bash
# Run individual scripts
npm run etl:crosswalk    # Build CBSA-County crosswalk
npm run etl:oews         # Build county-level OEWS data
npm run etl:projections  # Build state projections data

# Run all ETL steps and copy to public/
npm run etl:all
```

### ETL Process Flow

1. **CBSA Crosswalk** (`build-cbsa-crosswalk.ts`)
   - Reads: `data/raw/oews/cbsa-county-crosswalk.csv`
   - Filters: Florida counties only
   - Calculates: Equal allocation weights for multi-county CBSAs
   - Outputs: `data/intermediate/cbsa-county-crosswalk.json`

2. **County OEWS** (`build-oews-county.ts`)
   - Reads: `data/raw/oews/oews_fl_msa_<year>.csv`
   - Joins: With CBSA-County crosswalk
   - Allocates: Employment counts using weights; wages as regional averages
   - Outputs: `data/intermediate/oews_fl_county_<year>.json`

3. **State Projections** (`build-projections.ts`)
   - Reads: `data/raw/emp/projections_fl.csv`
   - Extracts: Growth rates, annual openings for target SOCs
   - Outputs: `data/intermediate/projections_fl.json`

4. **Copy to Public**
   - Copies processed JSON files to `public/data/` for client access

### Development Mode

If raw data files are not available, ETL scripts automatically generate **example data** for development and testing. This allows you to start building immediately without real data files.

## Data Types

All TypeScript types are defined in `src/lib/types.ts`:

- **CountyOews**: County-level employment and wage data
- **StateProjection**: State-level employment projections
- **SocMap**: SOC code to program mappings
- **CbsaCountyCrosswalk**: CBSA to county relationships

## API Endpoints

### BLS API Proxy
- **Endpoint**: `POST /api/bls`
- **Purpose**: Securely fetch live data from BLS API
- **Features**:
  - Server-side API key protection
  - Series whitelist for security
  - Rate limiting support

**Example Request:**
```javascript
const response = await fetch('/api/bls', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    seriesid: ['OEUM123456000000000000001'],
    startyear: '2020',
    endyear: '2023'
  })
});
```

## Environment Variables

Required environment variables in `.env.local`:

```bash
# Mapbox (required for map rendering)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token_here

# BLS API (optional, for live data fetches)
NEXT_PUBLIC_BLS_BASE_URL=https://api.bls.gov/publicAPI/v2
BLS_API_KEY=your_bls_api_key_here
```

## Data Loading in Application

The map component loads data using utilities from `src/lib/data-loaders.ts`:

```typescript
import { loadLaborStatistics, getCombinedData } from '@/lib/data-loaders';

// Load all data
const { oews, projections, socMap } = await loadLaborStatistics(2023);

// Get specific county/SOC data
const data = getCombinedData(oews, projections, '12057', '29-1141');
```

## Map Features

1. **Choropleth Visualization**: Counties colored by selected metric (employment, wages)
2. **SOC Filter Dropdown**: Select occupation to display
3. **Metric Selector**: Choose employment, mean wage, or median wage
4. **Interactive Tooltips**: Click counties to see detailed employment and projection data
5. **Legend**: Visual scale showing data ranges

## Updating Data

To update with new data:

1. Place new raw CSV files in `data/raw/oews/` or `data/raw/emp/`
2. Run ETL pipeline: `npm run etl:all`
3. Restart dev server to load new data

## Data Schema Examples

### County OEWS Record
```json
{
  "geoid": "12057",
  "countyName": "Hillsborough",
  "state": "FL",
  "year": 2023,
  "soc": "29-1141",
  "socTitle": "Registered Nurses",
  "employment": 18230,
  "meanWage": 78950,
  "medianWage": 76840,
  "hourlyMeanWage": 37.96,
  "hourlyMedianWage": 36.94
}
```

### State Projection Record
```json
{
  "state": "FL",
  "soc": "29-1141",
  "socTitle": "Registered Nurses",
  "baseYear": 2022,
  "projectionYear": 2032,
  "baseEmployment": 198450,
  "projectedEmployment": 223870,
  "employmentChange": 25420,
  "employmentChangePercent": 12.8,
  "annualOpenings": 18560
}
```

## Troubleshooting

### No data showing on map
1. Check browser console for data loading errors
2. Verify data files exist in `public/data/`
3. Run `npm run etl:all` to regenerate data
4. Check that GEO_ID format matches in GeoJSON and OEWS data

### ETL script fails
1. Verify input CSV files are in correct format
2. Check for missing columns in raw data
3. Review script console output for specific errors
4. Use example data mode (remove input files) for development

### BLS API errors
1. Verify `BLS_API_KEY` is set in `.env.local`
2. Check series IDs are in allowed whitelist
3. Respect BLS API rate limits (25 queries/day without key, 500/day with key)

## Future Enhancements

- [ ] Add more granular CBSA allocation weights (by population, land area)
- [ ] Support multiple years with time-series visualization
- [ ] Add export functionality for filtered data
- [ ] Integrate additional BLS series (CES, JOLTS, QCEW)
- [ ] Add comparison view for multiple occupations
- [ ] Include demographic breakdowns where available

