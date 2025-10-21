# 🧪 Growth Tiles - Test Guide

## ✅ Data Ready!

Growth metrics successfully computed from 2021-2024 OEWS MSA data:
- **162 MSA×SOC combinations** tracked
- **148 with YoY metrics** (2023→2024)
- **148 with 3-year trends** (2021→2024)

## 🎨 What You Should See

### Before (4 tiles):
```
┌─────────┬─────────┐
│ Employment│ Median  │
├─────────┼─────────┤
│ Mean    │ Range   │
└─────────┴─────────┘
```

### After (6 tiles):
```
┌─────────┬─────────┐
│ Employment│ Median  │
├─────────┼─────────┤
│ Mean    │ Range   │
├─────────┼─────────┤  ← NEW!
│ YoY Growth│ 3y Trend│
└─────────┴─────────┘
```

## 🧪 Test Cases

### 1. Miami - Registered Nurses (29-1141)
**Click Miami (bright blue, southeast)**

Expected Growth Tiles:
- **YoY Growth**: `+5.7% ▲` (green gradient)
  - Sublabel: "+1,750 jobs"
- **3-Year Trend**: `+12.7% ▲` (teal gradient)
  - Sublabel: "+6,770 jobs · +4.1% CAGR"

### 2. Tampa - Registered Nurses (29-1141)
**Click Tampa (purple, west coast)**

Expected:
- **YoY**: `+2.4% ▲` (green)
- **3-Year**: `+13.3% ▲` (teal)

### 3. Jacksonville - Registered Nurses (29-1141)
**Click Jacksonville (coral, northeast)**

Expected:
- **YoY**: `-1.3% ▼` (red gradient) ← Declining!
- **3-Year**: `+8.8% ▲` (teal) ← But growing long-term

### 4. Change SOC to Electricians (47-2111)
**Use dropdown → select "Electricians"**

Expected:
- Panel updates in place
- Different growth numbers appear
- Tiles animate briefly

### 5. Smaller MSA - Homosassa Springs (26140)
**Click Homosassa (pale turquoise, west coast)**

Some occupations may show:
- "—" with "Insufficient history" if data missing

## 🎨 Visual Indicators

### Trend Colors

| Trend | YoY Color | 3-Year Color |
|-------|-----------|--------------|
| **Up** (≥1%) | 🟢 Emerald | 🔵 Teal |
| **Down** (≤-1%) | 🔴 Red | 🟠 Orange |
| **Flat** (-1% to 1%) | ⚪ Gray | ⚪ Gray |

### Arrows
- **▲** = Up trend
- **▼** = Down trend  
- **–** = Flat trend

## 🔍 What to Check

### Visual
- [ ] Growth tiles appear below wage tiles
- [ ] Color-coded based on trend direction
- [ ] Arrows match trend (▲ for positive, ▼ for negative)
- [ ] Percentages formatted with 1 decimal (+3.2%)
- [ ] Job counts formatted with commas (1,750 jobs)
- [ ] CAGR shows when available

### Interaction
- [ ] Click MSA → panel opens with 6 tiles
- [ ] Change SOC → growth tiles update
- [ ] Hover growth tile → tooltip shows source
- [ ] Missing data shows "Insufficient history"

### Data Quality
- [ ] Miami RNs show +5.7% YoY, +12.7% 3-year
- [ ] Tampa RNs show positive growth
- [ ] Jacksonville RNs show -1.3% YoY (short-term decline)
- [ ] No mixing of scopes (all MSA data, no state fallback)

## 📱 Mobile Test

On phone/tablet (< 768px):
- [ ] Panel appears as bottom sheet
- [ ] Tiles stack in 2×2 grid
- [ ] All 6 tiles visible
- [ ] Growth tiles stack below wage tiles

## 🐛 Troubleshooting

### Growth tiles not showing
```bash
# Check if series file exists
ls -lh public/data/oews_fl_msa_series.json

# Should be ~60 KB with 162 records
```

### Data says "Insufficient history"
- Normal for some smaller MSAs or less common occupations
- BLS may have suppressed historical data

### Wrong colors/arrows
- Verify thresholds: Up ≥ 1%, Down ≤ -1%
- Check console for data loading confirmation

## ✅ Success Criteria

When working correctly:
1. ✅ Panel shows 6 tiles total (4 wage + 2 growth)
2. ✅ Growth percentages match spot checks
3. ✅ Arrows and colors align with trends
4. ✅ CAGR appears for true 3-year spans
5. ✅ Panel updates when changing SOCs
6. ✅ No console errors

## 📊 Real Data Examples

From the processed series:

**Cape Coral RNs**:
- 2021: 5,830 → 2024: 6,560
- YoY: +2.7% (+170 jobs)
- 3-year: +12.5% (+730 jobs, +4.0% CAGR)

**Jacksonville RNs**:
- 2023: 18,720 → 2024: 18,470
- YoY: -1.3% (-250 jobs) ← Recent decline
- 3-year: +8.8% (+1,500 jobs) ← Long-term growth

---

**Ready to test!** Refresh your browser at http://localhost:3000 🚀

