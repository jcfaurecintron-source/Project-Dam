# IPEDS Integration - Urban Institute Education Data API

Complete integration for fetching and aggregating Florida higher education institution data using the Urban Institute Education Data API (no API key required).

## Overview

This integration provides:
- **Python services** for fetching IPEDS institution data
- **County-level** and **MSA-level** aggregations
- **TypeScript API adapter** for frontend consumption
- **CLI tool** for data generation and verification
- **Comprehensive test suite** with 21 unit tests

## Architecture

```
services/
├── ipeds_client.py          # API client with pagination & caching
├── aggregation.py           # County & MSA aggregation logic
├── normalization.py         # FIPS code handling & county name normalization
├── year_resolver.py         # Latest data year resolution
└── institutions_by_msa.py   # High-level API for data access

bin/
└── ipeds_dump.py           # CLI tool for generating JSON output

tests/
├── test_ipeds_client.py     # API client tests
├── test_aggregation.py      # Aggregation logic tests
├── test_normalization.py    # Normalization tests
└── test_year_resolver.py    # Year resolution tests

florida-counties/
├── app/api/institutions/
│   └── route.ts            # Next.js API route
└── src/lib/
    └── institutions-api.ts  # TypeScript client library
```

## Data Flow

1. **API Fetch** → Urban Institute API (`educationdata.urban.org`)
2. **Normalization** → Extract county FIPS codes
3. **Aggregation** → Count by county FIPS
4. **MSA Mapping** → Roll up to MSAs using existing `county-to-msa.json`
5. **Output** → JSON with both county and MSA counts

## Usage

### Python Services

#### Fetch county-level counts:
```python
from services import get_institution_counts_by_county

# Get counts for latest available year
county_counts = get_institution_counts_by_county()
# Returns: {"12086": 72, "12011": 38, ...}  (FIPS → count)
```

#### Fetch MSA-level counts:
```python
from services import get_institution_counts_by_msa

msa_counts = get_institution_counts_by_msa()
# Returns: {"Miami-Fort Lauderdale-Pompano Beach, FL": 133, ...}
```

#### Get full aggregation:
```python
from services import get_full_aggregation

data = get_full_aggregation(year=2020)
# Returns:
# {
#   "county_counts": {"12086": 72, ...},
#   "msa_counts": {"Miami-Fort Lauderdale-Pompano Beach, FL": 133, ...},
#   "total": 356,
#   "year": 2020
# }
```

### CLI Tool

Generate JSON output files:

```bash
# County aggregation
./bin/ipeds_dump.py --year 2020 --by county --out data/county_counts.json --pretty

# MSA aggregation
./bin/ipeds_dump.py --year 2020 --by msa --out data/msa_counts.json --pretty

# Full aggregation (both county & MSA)
./bin/ipeds_dump.py --by full --out florida-counties/public/data/institutions_fl.json --pretty
```

**Options:**
- `--year <INT>`: Data year (default: latest available)
- `--by <county|msa|full>`: Aggregation level (default: msa)
- `--out <PATH>`: Output file (default: stdout)
- `--cache-dir <PATH>`: Cache directory (default: data/)
- `--mapping <PATH>`: Path to county-to-msa.json (default: auto-detect)
- `--pretty`: Pretty-print JSON output

### TypeScript/Frontend API

#### Server-side (Next.js API Route):

```typescript
// GET /api/institutions?by=msa
// Returns: [{ msa: "Miami-Fort Lauderdale-...", count: 133 }, ...]

// GET /api/institutions?by=county
// Returns: [{ fips: "12086", count: 72 }, ...]

// GET /api/institutions?by=full
// Returns full aggregation with metadata
```

#### Client-side:

```typescript
import { 
  fetchInstitutionsByMsa,
  fetchInstitutionsByCounty,
  getInstitutionCountForMsa 
} from '@/lib/institutions-api';

// Fetch all MSA counts
const msaCounts = await fetchInstitutionsByMsa();

// Get count for specific MSA
const miamiCount = await getInstitutionCountForMsa(
  "Miami-Fort Lauderdale-Pompano Beach, FL"
);
```

## Data Sources

### API Endpoint
- **Base URL**: `https://educationdata.urban.org/api/v1/college-university/ipeds/directory/`
- **No API key required**
- **Pagination**: Automatic (500 records per page)
- **Rate limiting**: Handled with exponential backoff

### MSA Mapping
- **Source**: `florida-counties/public/data/county-to-msa.json`
- **Format**: FIPS codes → MSA names
- **Coverage**: All 67 Florida counties (42 in MSAs, 25 non-MSA)

## Sample Output (2020 Data)

### Top MSAs by Institution Count:
1. **Miami-Fort Lauderdale-Pompano Beach, FL**: 133 institutions
2. **Tampa-St. Petersburg-Clearwater, FL**: 46 institutions
3. **Orlando-Kissimmee-Sanford, FL**: 42 institutions
4. **Jacksonville, FL**: 25 institutions
5. **Cape Coral-Fort Myers, FL**: 14 institutions

### Total Coverage:
- **356 total institutions** in Florida (2020)
- **21 MSAs** represented
- **47 counties** with at least one institution

## Testing

Run the complete test suite:

```bash
cd /Users/juanquifaure/Desktop/Project-Dam
python -m unittest discover tests/ -v
```

**Test Coverage:**
- ✅ API client (pagination, caching, retry logic)
- ✅ Aggregation (county, MSA, empty data handling)
- ✅ Normalization (FIPS conversion, name variants)
- ✅ Year resolution (backfill, caching, error handling)

**Results**: 21 tests, all passing

## Caching Strategy

### Local Cache:
- **Location**: `data/ipeds_institutions_FL_<year>.json`
- **Purpose**: Avoid redundant API calls
- **Invalidation**: Manual (delete cache file)

### Year Cache:
- **Location**: `data/ipeds_latest_year.txt`
- **Purpose**: Remember latest available year
- **Auto-generated**: First successful fetch

## Performance

- **Initial fetch** (no cache): ~5-10 seconds for 356 records
- **Cached fetch**: < 100ms
- **Aggregation**: < 10ms
- **API calls**: 1 page (all Florida data fits in 500-record limit)

## FIPS Code Handling

The API provides `county_fips` field directly (e.g., `12086` for Miami-Dade).

**Fallback chain:**
1. Use `county_fips` from API (most reliable)
2. Use `fips` field if 5 digits
3. Derive from `county_name` using built-in mapping

**County name normalization:**
- Remove " County" suffix
- Handle "Saint" → "St." conversion
- Title case with hyphen support

## Integration with Existing Systems

### MSA Mapping (Unchanged)
- ✅ Uses existing `county-to-msa.json` without modification
- ✅ Compatible with current frontend MSA display logic
- ✅ Consistent with BLS LAUS and population data structure

### Data Pipeline
```
1. Run: ./bin/ipeds_dump.py --by full --out florida-counties/public/data/institutions_fl.json
2. Frontend reads: /data/institutions_fl.json
3. API serves: /api/institutions?by=<msa|county|full>
```

## Error Handling

- **404 responses**: Automatic year backfill (tries current year, then year-1, etc.)
- **429 rate limiting**: Exponential backoff with `Retry-After` header support
- **500 errors**: Automatic retry (max 6 attempts)
- **Missing data**: Returns empty dict/list (no exceptions)
- **Invalid FIPS**: Silently skipped in aggregations

## Maintenance

### Update Data:
```bash
# Re-fetch latest year (bypasses cache)
rm data/ipeds_institutions_FL_*.json data/ipeds_latest_year.txt
./bin/ipeds_dump.py --by full --out florida-counties/public/data/institutions_fl.json --pretty
```

### Add New Years:
Data is automatically available as Urban Institute publishes it (typically annual updates).

## Dependencies

**Python:**
- `requests` (HTTP client)
- Standard library only (no pandas/numpy required)

**TypeScript/Frontend:**
- Next.js API routes (built-in)
- No additional dependencies

## Acceptance Criteria ✅

- [x] CLI outputs non-empty JSON for county and MSA aggregations
- [x] No API keys required for fetches
- [x] All network calls succeed with retry/caching logic
- [x] Tests pass locally (21/21)
- [x] Frontend API ready for integration
- [x] MSA mapping unchanged and compatible
- [x] Type-safe accessors for all consumers

## Next Steps

1. **Frontend Integration**: Wire `/api/institutions` into map components
2. **Analytics Jobs**: Use Python services for batch processing
3. **Scheduled Updates**: Add cron job to refresh data monthly
4. **Historical Trends**: Fetch multiple years for time-series analysis

## Contact

For questions or issues with this integration, refer to:
- **API Documentation**: https://urbaninstitute.github.io/education-data-api/
- **IPEDS Data Dictionary**: https://nces.ed.gov/ipeds/datacenter/DataFiles.aspx

