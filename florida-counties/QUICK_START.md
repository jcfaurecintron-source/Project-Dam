# 🚀 Quick Start - MSA Competitor Overlay

## Try It Now!

Your development server is running at: **http://localhost:3000**

### 30-Second Demo

1. **Open** `http://localhost:3000` in browser
2. **Click** Miami MSA (southeast Florida)
3. **See** three new tiles appear:
   - 🏙️ Population: ~6.2M
   - 🏫 Competitors: 1 school
   - 📊 Density: 0.016 per 100k
4. **Notice** red marker (🏫) on map
5. **Click** marker to see school details

That's it! 🎉

---

## What Just Happened?

Behind the scenes, the app:
1. ✅ Called Census API → Got population
2. ✅ Called College Scorecard API → Found schools
3. ✅ Filtered schools to MSA boundary → Spatial filtering
4. ✅ Limited to 1 school (Phase 1) → Stability testing
5. ✅ Calculated density metric → Schools per 100k
6. ✅ Cached result for 24 hours → Fast next time
7. ✅ Displayed marker and tiles → Visual overlay

---

## Try Different Combinations

### High Population MSA
- **Miami** (33100) - 6.2M people
- **Tampa** (45300) - 3.1M people

### Different Occupations
- **Registered Nurses** (29-1141) - Most programs
- **Electricians** (47-2111) - Trade schools
- **HVAC Mechanics** (49-9021) - Technical colleges

### Smaller Markets
- **Tallahassee** (45220) - 385k people
- **Panama City** - Smaller market

---

## What to Look For

### ✅ Good Signs
- Tiles show numbers (not "—")
- Red marker appears on map
- Marker popup has school info
- Console shows "✅ Fetched competitor overlay"
- Switching SOC updates markers

### ⚠️ Expected Behavior
- First click takes 2-5 seconds (API calls)
- Some combinations show no data (expected)
- Only 1 competitor shown (Phase 1 limit)
- Console may show "Cache hit" on repeat

### ❌ Problems
- No tiles appear → Check console for errors
- No markers → May be no schools for that program
- API errors → Census/Scorecard may be unavailable

---

## Console Commands

### View All Cached Data
```javascript
// Open browser console (F12) and type:
fetch('/api/msa/overlay?msa=33100&soc=29-1141')
  .then(r => r.json())
  .then(console.log)
```

### Test Multiple MSAs
```bash
# In terminal:
cd florida-counties
npx tsx scripts/test-msa-overlay.ts
```

---

## File Reference

| Need | See File |
|------|----------|
| User instructions | `MSA_OVERLAY_USER_GUIDE.md` |
| Technical details | `MSA_COMPETITOR_OVERLAY_SUMMARY.md` |
| Implementation status | `FEATURE_COMPLETE.md` |
| Quick start | `QUICK_START.md` (this file) |

---

## Phase 1 Note

🎯 **Current Version**: Limited to **1 competitor per MSA**

Why? Stability testing before scaling to full data.

Once validated → Phase 2 will show **all** competitors.

---

## Support SOC Codes

Only these 9 occupations have competitor data:

1. 29-1141 - Registered Nurses
2. 29-2032 - Diagnostic Medical Sonographers
3. 31-9092 - Medical Assistants
4. 29-2012 - Diagnostic Medical Technologists
5. 29-2055 - Surgical Technologists
6. 47-2111 - Electricians
7. 49-9021 - HVAC Mechanics
8. 51-4121 - Welders
9. 31-9096 - Veterinary Assistants

Others will show "No CIP mapping available."

---

## Next Actions

1. ✅ **Test manually** - Try 5-10 different MSAs
2. ✅ **Check metrics** - Do numbers make sense?
3. ✅ **Test SOC switching** - Does it update correctly?
4. ✅ **Verify caching** - Second click faster?
5. ✅ **Review docs** - Read user guide for details

Then:
- 📝 Provide feedback
- 🐛 Report any bugs
- 🚀 Prepare for Phase 2

---

**Happy exploring!** 🗺️📊🎓

