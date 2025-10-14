# Florida Counties Labor Market Map

A Next.js application that visualizes **live employment and wage statistics** for Florida counties using **CareerOneStop API** (official BLS OEWS data) and Mapbox GL JS.

## Features

- 🗺️ **Interactive Map**: Full-screen map of all 67 Florida counties
- 📊 **Live OEWS Data**: Real-time employment and wage data via CareerOneStop API
- 🏢 **MSA-Level Precision**: Data from 21 Florida Metropolitan Statistical Areas
- 🔍 **Occupation Filtering**: Select from 17 occupations across Allied Health, Trades, Nursing, and Veterinary fields
- 💡 **On-Demand Data**: Click any county to fetch live employment and wage statistics
- 🎯 **Smart Fallback**: MSA data for metro counties, state data for rural counties
- 🏛️ **DOL Compliance**: CareerOneStop attribution and terms adherence

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Mapping**: Mapbox GL JS
- **Data Processing**: Node.js with TypeScript (tsx)
- **Data Format**: GeoJSON for geography, JSON for statistics

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Mapbox access token ([Get one here](https://account.mapbox.com/access-tokens/))
- (Optional) BLS API key for live data ([Register here](https://www.bls.gov/developers/))

### Installation

1. **Clone the repository**
   ```bash
   cd florida-counties
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create `.env.local` in the project root:
   ```bash
   # Required - Mapbox
   NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
   
   # Required - CareerOneStop API (Live OEWS Data)
   CAREERONESTOP_USER_ID=your_user_id_here
   CAREERONESTOP_TOKEN=your_authorization_token_here
   ```

   **Get CareerOneStop credentials**:
   1. Register at https://www.careeronestop.org/WebAPI/Home
   2. Receive User ID and Token (same day)
   3. Add to `.env.local`

4. **Copy static data files**
   ```bash
   cp src/data/county-to-msa.json public/data/
   cp src/data/soc-map.json public/data/
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open the application**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
florida-counties/
├── app/                    # Next.js app directory
│   ├── api/bls/           # BLS API proxy endpoint
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── Map.tsx            # Basic map component
│   └── MapWithData.tsx    # Map with labor statistics
├── data/                  # Data pipeline
│   ├── raw/               # Raw CSV files (not in git)
│   ├── intermediate/      # Processed JSON (not in git)
│   └── ...
├── public/
│   ├── data/              # Client-accessible data files
│   └── florida-counties.geojson
├── scripts/               # ETL scripts
│   ├── build-cbsa-crosswalk.ts
│   ├── build-oews-county.ts
│   └── build-projections.ts
├── src/
│   ├── data/
│   │   └── soc-map.json   # SOC code mappings
│   └── lib/
│       ├── types.ts       # TypeScript definitions
│       └── data-loaders.ts # Data loading utilities
└── DATA_README.md         # Detailed data documentation
```

## Data Pipeline

### ETL Scripts

The project includes TypeScript ETL scripts to process raw BLS data:

```bash
# Build CBSA-to-County crosswalk
npm run etl:crosswalk

# Process OEWS MSA data to county level
npm run etl:oews

# Process state employment projections
npm run etl:projections

# Run all ETL steps and copy to public/
npm run etl:all
```

### Data Sources

1. **OEWS Data**: Metropolitan area employment and wage statistics
2. **CBSA Crosswalk**: Maps metro areas to constituent counties
3. **State Projections**: 10-year employment outlook for Florida
4. **SOC Mappings**: Links training programs to occupation codes

See [DATA_README.md](./DATA_README.md) for detailed documentation.

## Usage

### Viewing Labor Statistics

1. **Select an Occupation**: Use the dropdown to choose from 30+ occupations
2. **Choose a Metric**: Display employment, mean wage, or median wage
3. **Explore the Map**: Counties are color-coded from light (low) to dark (high)
4. **Click for Details**: Click any county to see:
   - Employment count
   - Mean and median wages
   - State-level growth projections
   - Annual job openings

### Available Occupations

The map includes data for:
- **Allied Health**: Medical Assistants, Physical Therapist Assistants, Dental Assistants, etc.
- **Trades**: Electricians, Plumbers, HVAC Technicians, Welders, etc.
- **Nursing**: Registered Nurses, Licensed Practical Nurses, Nurse Practitioners, etc.
- **Veterinary**: Veterinary Technicians, Assistants, and Veterinarians

### Updating Data

To update with new BLS data:

1. Download latest OEWS and projections CSV files
2. Place in `data/raw/oews/` and `data/raw/emp/`
3. Run `npm run etl:all`
4. Restart the development server

## API Endpoints

### BLS API Proxy

The application includes a secure proxy for BLS API requests:

**Endpoint**: `POST /api/bls`

**Request**:
```json
{
  "seriesid": ["OEUM123456000000000000001"],
  "startyear": "2020",
  "endyear": "2023"
}
```

**Features**:
- Server-side API key protection
- Series whitelist for security
- Supports up to 50 series per request

## Development

### Building for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

### Type Checking

TypeScript is configured with strict mode. All data types are defined in `src/lib/types.ts`.

## Configuration

### Mapbox Styles

The map uses the `mapbox://styles/mapbox/light-v11` style. To change:

```typescript
// In MapWithData.tsx
style: 'mapbox://styles/mapbox/streets-v11', // or your custom style
```

### Color Scale

The choropleth uses a blue color scale. To customize:

```typescript
// In MapWithData.tsx
function interpolateColor(t: number): string {
  // Modify RGB values here
}
```

## Troubleshooting

### Map not loading
- Verify `NEXT_PUBLIC_MAPBOX_TOKEN` is set in `.env.local`
- Check browser console for errors
- Ensure the token has the required scopes

### No data showing
- Run `npm run etl:all` to generate data
- Check that files exist in `public/data/`
- Verify GeoJSON GEOID format matches OEWS geoid

### ETL scripts failing
- Ensure input CSV files have correct column names
- Check `data/raw/` directories exist
- Review script console output for specific errors

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for educational and research purposes.

## Data Attribution

- **Employment Data**: U.S. Bureau of Labor Statistics, Occupational Employment and Wage Statistics (OEWS)
- **Projections**: Florida Department of Economic Opportunity
- **Geography**: U.S. Census Bureau TIGER/Line Shapefiles
- **Mapping**: Mapbox GL JS

## Support

For questions or issues:
- Review [DATA_README.md](./DATA_README.md) for data-specific questions
- Check the [BLS OEWS documentation](https://www.bls.gov/oes/)
- Open an issue on the repository

## Acknowledgments

Built with data from the Bureau of Labor Statistics and state workforce agencies. Map visualization powered by Mapbox.

---

**Note**: This application uses example data by default. For production use with real data, place raw OEWS CSV files in `data/raw/` and run the ETL pipeline.
