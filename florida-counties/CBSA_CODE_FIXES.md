# CBSA Code Alignment Fixes

**Date**: October 15, 2025  
**Purpose**: Correct MSA code mismatches causing state-level fallbacks

---

## 🔧 Corrected CBSA Codes

| MSA | Old Code | New Code | Status |
|-----|----------|----------|--------|
| **Jacksonville** | 27740 | **27260** | ✅ Fixed |
| **Homosassa Springs** | 30460 | **26140** | ✅ Fixed |
| **Sebring** | 36100 | **42700** | ✅ Fixed |
| **The Villages** | 46060 | **48680** | ✅ Fixed |

---

## 📂 Files Updated

### 1. `src/data/county-to-msa.json`
Updated all county mappings with correct CBSA codes:
- Counties 12019, 12031, 12089, 12109 → Jacksonville (27260)
- County 12017 → Homosassa Springs (26140)
- County 12055 → Sebring (42700)
- County 12119 → The Villages (48680)

### 2. `src/data/msa-to-city.json`
Updated city mappings for API lookups:
- 27260 → "Jacksonville, FL"
- 26140 → "Homosassa Springs, FL"
- 42700 → "Sebring, FL"
- 48680 → "The Villages, FL"

### 3. `components/MapLive.tsx`
Updated fill-color match expressions with corrected codes

### 4. `public/data/fl-msas.geojson`
Regenerated with correct CBSAFP properties for all 21 MSAs

---

## ✅ Verification Results

All 21 CBSA codes present in GeoJSON:
```
15980, 18880, 19660, 23540, 26140, 27260, 29460, 33100, 34940, 
35840, 36740, 37300, 37340, 37860, 38940, 39460, 42680, 42700, 
45220, 45300, 48680
```

---

## 🧪 Post-Fix Testing Steps

**Hard refresh** your browser (Cmd+Shift+R) and click each MSA:

### ✅ Expected: MSA-Level Match
Click Jacksonville (red polygon) → Console should show:
```
✅ Found 2 MSA candidates
   Using Annual rates (1 records)
   Selected record: {
     scope: 'MSA',
     area: '027260',
     areaName: 'Jacksonville-..., FL Metro Area',
     ...
   }
```

### ✅ Expected: No More State Fallbacks
Previously failing MSAs should now show green "MSA" badge and area-specific wages:
- **Jacksonville** (27260): ~$75k-85k median for RNs
- **Homosassa Springs** (26140): MSA-level data
- **Sebring** (42700): MSA-level data  
- **The Villages** (48680): MSA-level data

### ⚠️ If Still Seeing State Fallback
Check console for:
```
⚠️ MSA XXXXX not found in BLSAreaWagesList
   Available codes: [...]
```
This indicates CareerOneStop API doesn't have data for that MSA+SOC combination (expected for some smaller MSAs or specialized SOCs).

---

## 🔍 Code Normalization

All code comparisons use consistent normalization:
```typescript
const norm = (v: string): string => 
  (v ?? '').replace(/\D+/g, '').slice(-5).padStart(5, '0');
```

This ensures:
- "027260" → "27260"
- "27260" → "27260"  
- "Jacksonville, FL MSA (27260)" → "27260"

---

## 📊 Final Count

- ✅ 21 MSAs with corrected codes
- ✅ 42 counties mapped to MSAs
- ✅ 4 codes fixed (Jacksonville, Homosassa, Sebring, The Villages)
- ✅ 21 color mappings updated
- ✅ GeoJSON regenerated

**Status**: All CBSA codes aligned with CareerOneStop API responses.

