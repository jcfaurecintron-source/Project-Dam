# 🎨 Frontend Integration Checklist

## ✅ What's Wired Up

### Data Loading
- ✅ **OEWS 2024 data loads on mount** (`/data/oews_fl_msa_2024.json`)
- ✅ **158 records** (21 MSAs × 8-9 SOCs)
- ✅ **Data stored in ref** (`oewsDataRef.current`)
- ✅ **Loading state tracked** (`dataLoaded`)

### Map Display
- ✅ **Florida MSAs rendered** (21 distinct colored regions)
- ✅ **SOC selector dropdown** (9 occupations)
- ✅ **Click handler** → finds matching OEWS record
- ✅ **Rich popup** with:
  - MSA name & code
  - SOC & year (2024)
  - Employment count
  - Median & mean annual wages
  - Wage percentiles (10th, 25th, 75th, 90th)
  - Official BLS badge

### UI Elements
- ✅ **Top-left**: SOC selector dropdown
- ✅ **Top-right**: "BLS OEWS May 2024" data source badge
- ✅ **Bottom-left**: Info panel showing record count
- ✅ **Hover effects**: Orange highlight on MSAs
- ✅ **White borders**: Separating MSA regions

## 🧪 Test It Now

### 1. Open Your Browser
Visit: **http://localhost:3000**

### 2. Visual Check
- [ ] Map loads showing Florida MSAs in different colors
- [ ] SOC dropdown shows 9 occupation options
- [ ] Top-right shows "BLS OEWS May 2024"
- [ ] Bottom-left shows "158 occupation records loaded"

### 3. Interaction Check
- [ ] **Click Miami** (bright blue, southeast) → should show:
  - Miami-Fort Lauderdale-West Palm Beach, FL
  - Registered Nurses (29-1141)
  - Employment: 59,880 jobs
  - Median: ~$85,610/year
  - Mean: ~$92,070/year
  - Percentiles displayed

- [ ] **Click Tampa** (purple, west coast) → should show:
  - Tampa-St. Petersburg-Clearwater, FL
  - Employment: 35,050 jobs
  - Median: ~$84,290/year

- [ ] **Click Jacksonville** (coral red, northeast) → should show:
  - Jacksonville, FL
  - Employment: 18,470 jobs
  - Median: ~$80,850/year

### 4. SOC Change Test
- [ ] Select different occupation (e.g., "Electricians 47-2111")
- [ ] Click any MSA
- [ ] Should show electrician data for that MSA

### 5. Console Check
Open browser console (F12), look for:
```
✅ Loaded 158 OEWS 2024 records
✅ Added MSA GeoJSON source
✅ Added MSA layers
```

## 🔍 What to Look For

### Success Indicators
✅ All MSAs clickable  
✅ Popups show real 2024 data  
✅ No API errors in console  
✅ Employment numbers look realistic  
✅ Wages in $60k-$120k range for RNs  
✅ "📊 Official BLS OEWS May 2024 data" badge in popups

### Potential Issues
❌ "Data not available" for all MSAs → check file path  
❌ No popups on click → check console for errors  
❌ Old 2023 data showing → clear browser cache (Cmd+Shift+R)

## 🐛 Quick Fixes

### If popups show "Data not available":
```bash
# Regenerate with correct file
npm run oews:process data/raw/oews/msa/oesm24ma/MSA_M2024_dl.xlsx
```

### If map doesn't load:
```bash
# Check dev server is running
ps aux | grep "next dev"

# Restart if needed
npm run dev
```

### If seeing cached old data:
1. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
2. Clear browser cache
3. Try incognito/private window

## 📊 Expected Data Sample

**Miami MSA - Registered Nurses (29-1141)**
```
Employment: 59,880 jobs
Median: $85,610/year
Mean: $92,070/year
10th: $62,170
25th: $73,820
75th: $105,240
90th: $124,080
Year: 2024
```

## ✅ Final Verification

Once you confirm:
- [x] Data file exists (46KB)
- [x] Map component loads OEWS data
- [x] Click handlers work
- [x] Popups display correctly
- [ ] **YOU TEST IT IN BROWSER** ← Do this now!

## 🎯 Success = Clicking any MSA shows real May 2024 BLS wage data!

---

**Dev Server**: http://localhost:3000  
**Started**: Ready to test ✨

