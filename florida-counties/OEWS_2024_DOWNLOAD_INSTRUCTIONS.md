# OEWS May 2024 Data Download Instructions

## Manual Download Required

The BLS website blocks automated downloads. Please follow these steps to download the data manually:

### Step 1: Download the Data

1. Go to: [BLS OEWS Special Requests](https://www.bls.gov/oes/tables.htm)
2. Look for **May 2024** data
3. Download the **MSA (Metropolitan Statistical Area)** file
   - File is typically named: `all_data_M_2024.xlsx` or similar
   - Or download the zip: `oesm24ma.zip`

### Alternative Sources

If the above link doesn't work, try:
- https://www.bls.gov/oes/special.requests/oesm24ma.zip
- https://www.bls.gov/oes/tables.htm (navigate to May 2024 → MSA downloads)

### Step 2: Save the File

Save the downloaded file to:
```
/Users/juanquifaure/Desktop/Project-Dam/florida-counties/data/raw/oews/
```

Keep the original filename (e.g., `all_data_M_2024.xlsx` or extract from zip to get the Excel file)

### Step 3: Run the Processing Script

Once the file is downloaded, run:
```bash
npm run process-oews-2024
```

Or directly:
```bash
npx tsx scripts/process-oews-2024.ts
```

## What the Script Does

The processing script will:
- ✅ Filter to Florida MSAs only (21 MSAs)
- ✅ Filter to target SOC codes (9 occupations)
- ✅ Clean and normalize all data
- ✅ Handle suppressed values (**, #, blanks)
- ✅ Deduplicate records
- ✅ Validate completeness
- ✅ Generate `public/data/oews_fl_msa_2024.json`

## Expected Output Format

```json
{
  "msa_code": "33100",
  "msa_name": "Miami-Fort Lauderdale-Pompano Beach, FL",
  "soc": "29-1141",
  "employment": 12345,
  "median_annual": 80850,
  "mean_annual": 84210,
  "p10_annual": 65460,
  "p25_annual": 77220,
  "p75_annual": 97870,
  "p90_annual": 100980,
  "year": 2024
}
```

