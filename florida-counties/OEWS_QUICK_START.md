# OEWS 2024 Quick Start Guide

## 🚀 Get Started in 2 Commands

```bash
# 1. Download and process BLS OEWS May 2024 data
npm run oews:all

# 2. Start the development server
npm run dev
```

Visit http://localhost:3000 to see the interactive map with official BLS wage data!

## 📋 Available Commands

### Data Pipeline

| Command | Description |
|---------|-------------|
| `npm run oews:fetch` | Download OEWS data (with caching) |
| `npm run oews:process` | Process downloaded data |
| `npm run oews:all` | **Run both fetch + process** ⭐ |

### Manual Processing

If you need to specify a file:

```bash
npm run oews:process data/raw/oews/msa/oesm24ma/MSA_M2024_dl.xlsx
```

## 📊 What You Get

- **158 records** covering 21 Florida MSAs × 9 occupations
- **Official BLS data** (May 2024)
- **Rich wage information**:
  - Employment counts
  - Median & mean annual wages
  - Wage percentiles (10th, 25th, 75th, 90th)

## 🗺️ Interactive Map Features

1. **Click any MSA** to see detailed wage data
2. **Change occupations** using the dropdown selector
3. **View employment statistics** for each metro area
4. **Compare wages** across Florida regions

## 📁 Output Location

```
public/data/oews_fl_msa_2024.json  ← Your clean dataset
```

## ⚡ Smart Caching

The fetcher automatically:
- Checks if BLS file has changed (HTTP 304)
- Verifies SHA256 checksums
- Skips redownload if unchanged
- Only reprocesses when needed

**First run**: ~40 MB download + processing (~30 sec)  
**Subsequent runs**: Instant (uses cache) ⚡

## 🔄 Updating Next Year

When May 2025 data is released:

1. Edit `oews.config.json`:
   ```json
   {
     "year": 2025,
     "file": "oesm25ma.zip",
     "directUrl": "https://www.bls.gov/oes/special-requests/oesm25ma.zip"
   }
   ```

2. Run:
   ```bash
   npm run oews:all
   ```

Done! ✅

## 🆘 Troubleshooting

### BLS Server Blocks Download
If automated download fails:

1. Go to https://www.bls.gov/oes/tables.htm
2. Download May 2024 → MSA data (Excel or ZIP)
3. Save to `data/raw/oews/` (keep original filename)
4. Run: `npm run oews:process`

### No Data Showing
```bash
# Regenerate with correct MSA file
npm run oews:process data/raw/oews/msa/oesm24ma/MSA_M2024_dl.xlsx
```

### Cache Issues
```bash
# Delete cache and redownload
rm data/raw/oews/oesm24ma.zip*
npm run oews:all
```

## 📚 More Info

- **Full Documentation**: [OEWS_2024_INTEGRATION_SUMMARY.md](./OEWS_2024_INTEGRATION_SUMMARY.md)
- **Manual Download**: [OEWS_2024_DOWNLOAD_INSTRUCTIONS.md](./OEWS_2024_DOWNLOAD_INSTRUCTIONS.md)
- **Config File**: [oews.config.json](./oews.config.json)

## ✅ Verification

Check your data is ready:

```bash
# Should show 45.74 KB file with 158 records
ls -lh public/data/oews_fl_msa_2024.json

# Spot check Miami RN data
grep -A 10 '"33100".*"29-1141"' public/data/oews_fl_msa_2024.json
```

Expected: Employment ~59,880, Median ~$85,610

---

**Need help?** See [OEWS_2024_INTEGRATION_SUMMARY.md](./OEWS_2024_INTEGRATION_SUMMARY.md) for detailed info

