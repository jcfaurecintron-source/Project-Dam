# OEWS May 2024 Integration Summary

## ✅ Completed Integration

Successfully integrated official BLS OEWS May 2024 MSA-level employment and wage data for Florida metros.

### Data Overview

- **Source**: Bureau of Labor Statistics (BLS) OEWS May 2024
- **Scope**: 21 Florida Metropolitan Statistical Areas  
- **Target SOCs**: 9 healthcare and skilled trade occupations
- **Records**: 158 MSA×SOC combinations
- **File Size**: 45.74 KB
- **Output**: `public/data/oews_fl_msa_2024.json`

### Florida MSAs Covered

All 21 Florida MSAs with comprehensive data:

| MSA Code | MSA Name | SOCs Available |
|----------|----------|----------------|
| 33100 | Miami-Fort Lauderdale-West Palm Beach, FL | 8 |
| 45300 | Tampa-St. Petersburg-Clearwater, FL | 8 |
| 36740 | Orlando-Kissimmee-Sanford, FL | 8 |
| 27260 | Jacksonville, FL | 8 |
| 15980 | Cape Coral-Fort Myers, FL | 8 |
| 35840 | North Port-Bradenton-Sarasota, FL | 8 |
| 34940 | Naples-Marco Island, FL | 8 |
| 29460 | Lakeland-Winter Haven, FL | 8 |
| 37340 | Palm Bay-Melbourne-Titusville, FL | 8 |
| 38940 | Port St. Lucie, FL | 8 |
| 39460 | Punta Gorda, FL | 8 |
| 42680 | Sebastian-Vero Beach-West Vero Corridor, FL | 8 |
| 45220 | Tallahassee, FL | 8 |
| 36100 | Ocala, FL | 8 |
| 19660 | Deltona-Daytona Beach-Ormond Beach, FL | 8 |
| 18880 | Crestview-Fort Walton Beach-Destin, FL | 7 |
| 23540 | Gainesville, FL | 7 |
| 37860 | Pensacola-Ferry Pass-Brent, FL | 7 |
| 48680 | Wildwood-The Villages, FL | 7 |
| 26140 | Homosassa Springs, FL | 5 |
| 42700 | Sebring, FL | 5 |

### Target SOC Codes

- **29-1141**: Registered Nurses ✅
- **29-2032**: Diagnostic Medical Sonographers ✅
- **31-9092**: Medical Assistants ✅
- **29-2012**: Medical and Clinical Laboratory Technicians ✅
- **29-2055**: Surgical Technologists ✅
- **47-2111**: Electricians ✅
- **49-9021**: HVAC Mechanics ✅
- **51-4121**: Welders ✅
- **31-9096**: Veterinary Assistants (limited availability)

### Sample Data (Miami MSA - Registered Nurses)

```json
{
  "msa_code": "33100",
  "msa_name": "Miami-Fort Lauderdale-West Palm Beach, FL",
  "soc": "29-1141",
  "employment": 59880,
  "median_annual": 85610,
  "mean_annual": 92070,
  "p10_annual": 62170,
  "p25_annual": 73820,
  "p75_annual": 105240,
  "p90_annual": 124080,
  "year": 2024
}
```

## 🔧 Technical Implementation

### 1. Automated Fetcher (`scripts/oews-fetch.ts`)

**Features**:
- ✅ Direct URL fetch with proper HTTP etiquette
- ✅ HEAD request with `If-Modified-Since` and `If-None-Match` caching
- ✅ SHA256 integrity verification
- ✅ Automatic ZIP extraction
- ✅ Smart workbook detection (prioritizes MSA files)
- ✅ Rate limiting and backoff
- ✅ Structured error codes

**Exit Codes**:
- `0`: Success (downloaded or cached)
- `1`: E_FILE_NOT_FOUND (404)
- `2`: E_BLS_THROTTLE (403/429)
- `3`: E_CORRUPT_ARCHIVE
- `4`: E_NETWORK_ERROR

**Caching Behavior**:
- 304 Not Modified → skip download, use cached data
- SHA256 match → skip reprocessing
- Stores: Last-Modified, ETag, checksum

### 2. Data Processor (`scripts/process-oews-2024.ts`)

**Features**:
- ✅ Reads Excel/CSV formats (via `xlsx` library)
- ✅ Flexible column name matching
- ✅ Handles suppressed data (**, #, blanks → null)
- ✅ MSA code normalization (5-digit zero-padded)
- ✅ SOC code normalization (XX-XXXX format)
- ✅ Intelligent deduplication
- ✅ Comprehensive validation

**Input Sources** (priority order):
1. CLI argument (file path)
2. Fetch result (`data/raw/oews/fetch-result.json`)
3. Auto-detect in `data/raw/oews/msa/`
4. Auto-detect in `data/raw/oews/`

**Validation Checks**:
- ✅ All Florida MSAs present
- ✅ SOC coverage (8/9 found)
- ✅ Anomaly detection (wages < $20k or > $300k)
- ✅ Spot checks (Miami, Tampa, Jacksonville RNs)

### 3. Map Integration (`components/MapLive.tsx`)

**Updates**:
- ✅ Loads OEWS 2024 data on mount
- ✅ Displays official BLS data (no API calls)
- ✅ Rich popup with:
  - Employment count
  - Median & mean annual wages
  - Wage percentiles (10th, 25th, 75th, 90th)
  - Year indicator (2024)
- ✅ Updated data source badge
- ✅ Removed CareerOneStop API dependency

## 📊 Output Format

**Structure**: Array of records, one per MSA×SOC combination

**Fields**:
- `msa_code` (string): 5-digit CBSA code
- `msa_name` (string): Full MSA name
- `soc` (string): 7-character SOC code
- `employment` (number|null): Total employment
- `median_annual` (number|null): Median annual wage ($)
- `mean_annual` (number|null): Mean annual wage ($)
- `p10_annual` (number|null): 10th percentile annual wage ($)
- `p25_annual` (number|null): 25th percentile annual wage ($)
- `p75_annual` (number|null): 75th percentile annual wage ($)
- `p90_annual` (number|null): 90th percentile annual wage ($)
- `year` (number): Data year (2024)

**Join Key**: `CBSAFP` (GeoJSON) ⇄ `msa_code` (data)

## 🚀 Usage

### First-Time Setup

1. **Run the complete pipeline**:
   ```bash
   npm run oews:all
   ```

   This will:
   - Download OEWS May 2024 MSA data (38.33 MB)
   - Extract workbooks
   - Parse and filter for Florida MSAs + target SOCs
   - Generate `public/data/oews_fl_msa_2024.json`

2. **Manual processing** (if needed):
   ```bash
   npm run oews:process data/raw/oews/msa/oesm24ma/MSA_M2024_dl.xlsx
   ```

### Subsequent Runs

The fetcher automatically uses HTTP caching:

```bash
npm run oews:fetch
# → 304 Not Modified → uses cached data, no redownload

npm run oews:process
# → Processes from fetch result or auto-detects file
```

### Updating to New Year

1. Update `oews.config.json`:
   ```json
   {
     "year": 2025,
     "file": "oesm25ma.zip",
     "directUrl": "https://www.bls.gov/oes/special-requests/oesm25ma.zip",
     ...
   }
   ```

2. Run:
   ```bash
   npm run oews:all
   ```

## ✅ Validation Results

### Coverage
- **MSAs**: 21/21 ✅
- **SOCs**: 8/9 (31-9096 has limited availability)
- **Records**: 158

### Spot Checks (Registered Nurses, SOC 29-1141)

| MSA | Code | Employment | Median Annual |
|-----|------|------------|---------------|
| Miami | 33100 | 59,880 | $85,610 |
| Tampa | 45300 | 35,050 | $84,290 |
| Jacksonville | 27260 | 18,470 | $80,850 |

All values are plausible and non-null ✅

### Anomalies
No records with median wages < $20,000 or > $300,000 ✅

## 📁 Files Created

### Data Files
- `public/data/oews_fl_msa_2024.json` - Clean output dataset
- `data/raw/oews/oesm24ma.zip` - Original BLS ZIP (38.33 MB)
- `data/raw/oews/oesm24ma.zip.sha256` - Checksum file
- `data/raw/oews/oesm24ma.zip.metadata.json` - Cache metadata
- `data/raw/oews/fetch-result.json` - Fetch operation result
- `data/raw/oews/msa/oesm24ma/MSA_M2024_dl.xlsx` - Extracted MSA workbook

### Scripts
- `scripts/oews-fetch.ts` - Automated fetcher with caching
- `scripts/process-oews-2024.ts` - Data processor with validation
- `scripts/download_oews_2024.py` - Python fallback (if needed)

### Documentation
- `OEWS_2024_DOWNLOAD_INSTRUCTIONS.md` - Manual download guide
- `OEWS_2024_INTEGRATION_SUMMARY.md` - This document
- `oews.config.json` - Configuration file

### Map Updates
- `components/MapLive.tsx` - Updated to use 2024 data

## 🔐 Compliance

- ✅ No BLS API calls (file-based only)
- ✅ Raw files preserved unmodified
- ✅ All transformations reproducible
- ✅ No secrets or credentials required
- ✅ Proper HTTP etiquette (User-Agent, caching)

## 🎯 Next Steps

1. **Test the map**:
   ```bash
   npm run dev
   ```
   Visit http://localhost:3000 and verify MSA data displays correctly

2. **Optional**: Add choropleth coloring by median wage

3. **Future**: Automate monthly/annual data updates

## 📝 Notes

- One SOC (31-9096 Veterinary Assistants) has limited availability across MSAs
- Smaller MSAs (Homosassa Springs, Sebring) have fewer occupations due to BLS suppression rules
- The fetcher includes intelligent retry logic with backoff for transient errors
- Caching prevents unnecessary re-downloads (saves bandwidth and time)

---

**Status**: ✅ Complete - Ready for production use
**Last Updated**: October 16, 2025
**Data Version**: BLS OEWS May 2024

