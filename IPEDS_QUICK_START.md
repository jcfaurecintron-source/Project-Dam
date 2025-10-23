# IPEDS Integration - Quick Start Guide

## 🎯 What You Got

A complete, no-key IPEDS integration for Florida higher education institutions with Python services, CLI tool, TypeScript API, and 21 passing tests.

**Data**: 356 institutions → 47 counties → 21 MSAs (2020)

---

## 🚀 Quick Usage

### CLI (Generate Data)

```bash
# Generate production data file
./bin/ipeds_dump.py --by full \
  --out florida-counties/public/data/institutions_fl.json \
  --pretty

# Test specific aggregations
./bin/ipeds_dump.py --year 2020 --by msa --pretty
./bin/ipeds_dump.py --year 2020 --by county --pretty
```

### Python API

```python
from services import get_institution_counts_by_msa, get_institution_counts_by_county

# Get MSA counts
msa_counts = get_institution_counts_by_msa(year=2020)
# Returns: {"Miami-Fort Lauderdale-Pompano Beach, FL": 133, ...}

# Get county counts  
county_counts = get_institution_counts_by_county(year=2020)
# Returns: {"12086": 72, "12011": 38, ...}
```

### TypeScript/Frontend API

```typescript
// In your Next.js component
import { fetchInstitutionsByMsa } from '@/lib/institutions-api';

const institutions = await fetchInstitutionsByMsa();
// Returns: [{ msa: "Miami-Fort Lauderdale...", count: 133 }, ...]

// Or use the API route directly
const response = await fetch('/api/institutions?by=msa');
const data = await response.json();
```

---

## 📁 What Was Created

```
Project-Dam/
├── services/                    # Python service layer
│   ├── ipeds_client.py         # API client (pagination, caching, retry)
│   ├── aggregation.py          # County/MSA aggregation logic
│   ├── normalization.py        # FIPS code handling
│   ├── year_resolver.py        # Latest year detection
│   └── institutions_by_msa.py  # High-level API
│
├── bin/
│   └── ipeds_dump.py           # CLI tool (executable)
│
├── tests/                       # Unit tests (21 tests, all passing)
│   ├── test_ipeds_client.py
│   ├── test_aggregation.py
│   ├── test_normalization.py
│   └── test_year_resolver.py
│
├── florida-counties/
│   ├── app/api/institutions/   # Next.js API route
│   │   └── route.ts
│   ├── src/lib/
│   │   └── institutions-api.ts # TypeScript client
│   └── public/data/
│       └── institutions_fl.json # Production data
│
└── data/                        # Cache directory
    ├── ipeds_institutions_FL_2020.json
    └── ipeds_latest_year.txt
```

---

## 🔥 Top Use Cases

### 1. Add Institution Count to Map Overlay

```typescript
// In your map component
import { getInstitutionCountForMsa } from '@/lib/institutions-api';

const msaData = [...]; // Your existing MSA data
for (const msa of msaData) {
  msa.institutionCount = await getInstitutionCountForMsa(msa.name);
}
```

### 2. Generate Analytics Report

```python
from services import get_full_aggregation

data = get_full_aggregation(year=2020)
print(f"Total: {data['total']} institutions")
print(f"Top MSA: {max(data['msa_counts'].items(), key=lambda x: x[1])}")
```

### 3. Update Data Monthly

```bash
#!/bin/bash
# Add to cron: 0 0 1 * * /path/to/update_institutions.sh

cd /Users/juanquifaure/Desktop/Project-Dam
rm data/ipeds_latest_year.txt  # Force re-check for latest year
./bin/ipeds_dump.py --by full \
  --out florida-counties/public/data/institutions_fl.json \
  --pretty
```

---

## ✅ Verification Checklist

Run these to verify everything works:

```bash
# 1. Run tests
python -m unittest discover tests/

# 2. Test CLI
./bin/ipeds_dump.py --by msa

# 3. Verify production data exists
cat florida-counties/public/data/institutions_fl.json

# 4. Test Python API
python -c "from services import get_institution_counts_by_msa; print(len(get_institution_counts_by_msa()))"
```

Expected results:
- ✅ 21 tests pass
- ✅ CLI outputs 21 MSA counts
- ✅ Production file has 356 total institutions
- ✅ Python API returns 21 MSAs

---

## 📊 Sample Output

```json
{
  "county_counts": {
    "12086": 72,  // Miami-Dade
    "12011": 38,  // Broward
    "12057": 23,  // Hillsborough
    ...
  },
  "msa_counts": {
    "Miami-Fort Lauderdale-Pompano Beach, FL": 133,
    "Tampa-St. Petersburg-Clearwater, FL": 46,
    "Orlando-Kissimmee-Sanford, FL": 42,
    ...
  },
  "total": 356,
  "year": 2020
}
```

---

## 🔧 Configuration

### Change Data Year
```bash
./bin/ipeds_dump.py --year 2019 --by full --out output.json
```

### Custom Cache Directory
```bash
./bin/ipeds_dump.py --cache-dir /path/to/cache --by msa
```

### Use Different MSA Mapping
```bash
./bin/ipeds_dump.py --mapping /path/to/custom-mapping.json --by msa
```

---

## 🐛 Troubleshooting

### "Module 'requests' not found"
```bash
# Activate venv first
source venv/bin/activate
pip install -r requirements.txt
```

### "No data for year 2024"
The API might not have 2024 data yet. The year resolver automatically falls back to 2023, 2022, etc.

### "Empty output"
```bash
# Clear cache and retry
rm data/ipeds_*.json data/ipeds_*.txt
./bin/ipeds_dump.py --year 2020 --by full --pretty
```

---

## 📖 Full Documentation

- **Complete Guide**: `IPEDS_INTEGRATION_README.md`
- **Implementation Details**: `IPEDS_INTEGRATION_SUMMARY.md`
- **API Docs**: https://urbaninstitute.github.io/education-data-api/

---

## 🎉 Summary

You now have:
- ✅ **684 lines** of Python services
- ✅ **21 passing** unit tests
- ✅ **No API keys** required
- ✅ **356 institutions** indexed
- ✅ **21 MSAs** + **47 counties** covered
- ✅ **TypeScript types** for frontend
- ✅ **Production data** generated
- ✅ **Ready to integrate** into your map

**Next Step**: Wire `/api/institutions` into your map components! 🗺️

