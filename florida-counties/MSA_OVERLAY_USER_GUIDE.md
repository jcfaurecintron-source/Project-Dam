# MSA Competitor Overlay - User Guide

## What's New? 🎉

Your Florida MSA map now shows **competitor educational institutions** with real-time data from government APIs!

## How to Use

### 1. View the Map
- Open your browser to `http://localhost:3000`
- You'll see the familiar Florida MSA map

### 2. Select an Occupation
- Use the SOC selector dropdown at the top
- Choose from 9 supported occupations:
  - Registered Nurses
  - Diagnostic Medical Sonographers
  - Medical Assistants
  - Diagnostic Medical Technologists
  - Surgical Technologists
  - Electricians
  - HVAC Mechanics
  - Welders
  - Veterinary Assistants

### 3. Click an MSA
- Click any MSA (Metropolitan Statistical Area) on the map
- The **InsightPanel** will open showing:
  
  **Existing Tiles:**
  - Employment (jobs)
  - Mean Annual Wage
  - YoY Growth (% change)
  - Median Annual Wage
  - 3-Year Trend (with sparkline)
  - Wage Range (P10-P90)
  
  **NEW Tiles:**
  - 🏙️ **Population** - Total MSA population (Census 2022)
  - 🏫 **Competitors** - Number of schools offering this program
  - 📊 **Density** - Schools per 100,000 people

### 4. View Competitor Markers
- Red circular markers (🏫) appear on the map
- Each marker represents a competing institution
- **Click a marker** to see:
  - School name
  - City location
  - Website link
  - CIP codes (program classifications)

### 5. Change Occupations
- Switch to a different SOC code in the dropdown
- Watch the markers automatically update
- New competitor data loads for the new occupation
- InsightPanel refreshes with new metrics

### 6. Close the Panel
- Click the X button or press ESC
- All markers disappear
- Map returns to clean state

## Understanding the Metrics

### Population
- **Source**: U.S. Census Bureau (ACS 2022)
- **What it means**: Total people living in this MSA
- **Use case**: Understand market size

### Competitors
- **Source**: Department of Education College Scorecard
- **What it means**: Schools offering programs matching this occupation
- **Phase 1 Note**: Limited to 1 school for testing
- **Use case**: Assess competition level

### Density
- **Formula**: (Competitors / Population) × 100,000
- **What it means**: Number of competing schools per 100k people
- **Higher = More Competition**: More schools serving the same population
- **Lower = Opportunity**: Fewer schools, potential gap in market
- **Use case**: Identify underserved markets

## Example Scenario

**You want to start a Nursing program in Florida...**

1. Select **"29-1141 - Registered Nurses"** from dropdown
2. Click **Miami MSA** on the map
3. See:
   - Population: ~6.2 million people
   - Competitors: 1 school (Miami Dade College)
   - Density: 0.016 per 100k
4. Click the red marker to visit Miami Dade's website
5. Compare with **Tallahassee MSA**:
   - Population: ~385,000 people
   - Competitors: 1 school
   - Density: 0.260 per 100k (higher competition relative to population)

**Insight**: Miami has lower density = potentially more room for additional programs despite high competition in absolute numbers.

## Supported MSAs (All 21 Florida MSAs)

- Cape Coral-Fort Myers
- Crestview-Fort Walton Beach-Destin
- Deltona-Daytona Beach-Ormond Beach
- Fort Lauderdale-Pompano Beach-Sunrise (MD)
- Gainesville
- Homosassa Springs
- Jacksonville
- Lakeland-Winter Haven
- Miami-Miami Beach-Kendall (MD)
- Naples-Marco Island
- North Port-Sarasota-Bradenton
- Ocala
- Orlando-Kissimmee-Sanford
- Palm Bay-Melbourne-Titusville
- Panama City
- Pensacola-Ferry Pass-Brent
- Port St. Lucie
- Punta Gorda
- Sebastian-Vero Beach
- Tallahassee
- Tampa-St. Petersburg-Clearwater
- West Palm Beach-Boca Raton-Boynton Beach (MD)

## Data Sources

All data is fetched live from official government APIs:

1. **Census Bureau API**
   - Population estimates (ACS 2022)
   - No registration required
   - Updated annually

2. **Department of Education College Scorecard**
   - Institution locations and programs
   - CIP-based program matching
   - Updated 2024 data

3. **BLS OEWS (existing)**
   - Employment and wage data
   - May 2024 latest

## Performance & Caching

- **First Click**: ~2-5 seconds (API calls to Census + College Scorecard)
- **Subsequent Clicks**: Instant (cached for 24 hours)
- **Cache Reset**: Automatic after 24 hours
- **Rate Limiting**: Built-in delays to respect API limits

## Troubleshooting

### No Population Data
- Some smaller MSAs may not have Census data available
- Panel will show "—" for population
- Density cannot be calculated without population

### No Competitors Found
- The selected occupation may not have matching CIP codes
- Or no Florida schools offer that program in this MSA
- Panel will show 0 competitors

### Markers Don't Appear
- Check browser console for errors (F12)
- Verify server is running (`npm run dev`)
- Try refreshing the page

### API Errors
- Census API might be temporarily unavailable
- College Scorecard API might be down
- Map continues working with existing wage/employment data
- Competitor tiles will show "—"

## Testing the Feature

Run the test script to verify all MSAs:

```bash
cd florida-counties
npx tsx scripts/test-msa-overlay.ts
```

This will test 6 major MSAs with 3 different occupations and show success/failure rates.

## Phase 1 Limitations

⚠️ **Current Version (Phase 1 - Validation)**

- **Limited to 1 institution per MSA** for stability testing
- Once validated, Phase 2 will show ALL competitors
- No historical trends (snapshot only)
- No program size/completions data yet

## What's Coming in Phase 2?

🚀 **Planned Enhancements:**

1. **Remove 1-school limit** - Show all competitors
2. **Marker clustering** - Handle dense MSAs gracefully
3. **Program intensity** - Add completions data
4. **CareerOneStop integration** - Include non-degree programs
5. **Advanced filtering** - By school type, size, etc.
6. **Historical trends** - Track competitor changes over time

## Tips for Best Results

✅ **Do:**
- Test with major MSAs first (Miami, Tampa, Orlando)
- Try different occupations to see data variety
- Click markers to explore school details
- Use density metric to identify opportunities

❌ **Don't:**
- Expect instant results on first click (APIs take time)
- Rely on Phase 1 competitor counts for decisions (only shows 1)
- Compare density across vastly different MSA sizes without context

## Support & Feedback

- Check browser console for detailed logs
- Review `MSA_COMPETITOR_OVERLAY_SUMMARY.md` for technical details
- Report issues with specific MSA codes and SOC codes

## Quick Reference

| Metric | Source | Update Frequency | Use Case |
|--------|--------|------------------|----------|
| Population | Census ACS | Annual | Market size |
| Competitors | College Scorecard | Annual | Competition level |
| Density | Calculated | Real-time | Market saturation |
| Employment | BLS OEWS | Annual | Job demand |
| Wages | BLS OEWS | Annual | Salary expectations |
| Growth | BLS OEWS History | Quarterly | Market trends |

---

**Enjoy exploring Florida's educational landscape!** 🎓📊🗺️

