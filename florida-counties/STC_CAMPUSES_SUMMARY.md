# 🎓 Southern Technical College Campus Overlay - Complete

## ✅ What Was Added

Added **7 Southern Technical College campus locations** as clustered, clickable map markers that overlay the MSA visualization without affecting the existing UI.

## 📍 Campus Locations

| # | Campus | Address | Location |
|---|--------|---------|----------|
| 1 | **Auburndale** | 450 Havendale Blvd | Lakeland-Winter Haven MSA |
| 2 | **Brandon** | 608 E. Bloomingdale Ave | Tampa MSA |
| 3 | **Fort Myers** | 1685 Medical Lane | Cape Coral-Fort Myers MSA |
| 4 | **Orlando** | 1485 Florida Mall Ave | Orlando MSA |
| 5 | **Port Charlotte** | 950 Tamiami Trail #109 | Punta Gorda MSA |
| 6 | **Sanford** | 2910 S. Orlando Drive | Orlando MSA |
| 7 | **Tampa** | 3910 Riga Blvd | Tampa MSA |

## 🎨 Visual Design

### Campus Markers
- **Color**: Sky blue (`#0ea5e9`) - distinct from MSA colors
- **Icon**: 🎓 Graduation cap emoji
- **Size**: 8px radius circles
- **Stroke**: 2px white border for visibility

### Clustering
- **Activates**: When multiple campuses are close together
- **Max Zoom**: Clusters until zoom level 14
- **Cluster Radius**: 50px
- **Size**: Scales based on campus count (15-22px)
- **Label**: Shows number of campuses in cluster

### Interaction
- **Hover**: Cursor changes to pointer
- **Click Campus**: Shows popup with details + "Visit Campus" link
- **Click Cluster**: Zooms in to expand cluster

## 🎯 Features

### Non-Invasive Design
- ✅ Points render **above MSA polygons**
- ✅ Don't interfere with MSA click handlers
- ✅ Distinct color scheme (blue vs MSA pastels)
- ✅ Small, subtle footprint
- ✅ Optional to interact with

### Campus Popup Content
```
┌─────────────────────────────┐
│ 🎓 Southern Technical       │
│    College - Tampa          │
├─────────────────────────────┤
│ 📍 3910 Riga Blvd,         │
│    Tampa, FL 33619          │
├─────────────────────────────┤
│ [ Visit Campus → ]          │
└─────────────────────────────┘
```

Shows:
- Campus name with 🎓 icon
- Full address with 📍 icon
- Link button to campus website

### Clustering Behavior

**Zoomed Out** (showing entire Florida):
```
    ┌──┐
    │ 2│  ← Cluster: 2 campuses nearby
    └──┘
```

**Zoomed In** (individual campuses):
```
    🎓   🎓   🎓  ← Individual markers
```

**Click cluster** → Zooms in to show individual campuses

## 📁 Files Created/Modified

### New Files
1. **`public/data/stc-campuses.json`** - Campus data (7 locations)

### Modified Files
1. **`components/MapLive.tsx`** - Added campus overlay (~160 lines)

## 🧪 Test It

### Visual Check
- [ ] See small blue circles with 🎓 icons across Florida
- [ ] Markers appear **above** MSA polygons
- [ ] Some campuses may cluster at low zoom

### Interaction Test
1. **Click Tampa area** (west coast)
   - You might see 2 campuses (Brandon + Tampa)
   - Or a cluster with "2"
2. **Click cluster** → Zooms in to show both campuses
3. **Click individual 🎓** → Shows campus popup
4. **Click "Visit Campus →"** → Opens STC website in new tab

### MSA Still Works
- [ ] Click MSA polygon (not the marker) → InsightPanel opens
- [ ] Campus markers don't block MSA interactions
- [ ] Both systems work independently

## 🎨 Legend Integration

Added to bottom-left info panel:
```
Florida MSAs
21 Metropolitan Statistical Areas
• 8 occupations available
• Click any MSA for wage data
• White borders separate regions
─────────────────────────────
🎓 Blue markers = Southern Technical College campuses
```

## 🎯 Design Principles

### Layering
```
Bottom → Top:
1. MSA Polygons (filled, colored)
2. MSA Outlines (white borders)
3. Campus Markers (blue circles + 🎓)
4. UI Controls (dropdowns, panels)
```

### Color Hierarchy
- **MSA Fill**: Varied pastels (blue, purple, coral, etc.)
- **MSA Borders**: White (#FFFFFF)
- **Campus Markers**: Sky blue (#0ea5e9)
- **MSA Hover**: Orange (#ff6600)

### Interaction Priority
1. Campus markers catch clicks first (higher z-index)
2. MSA polygons catch clicks if no marker present
3. Both can be interacted with independently

## 📊 Coverage

### MSAs with STC Campuses

| MSA | Campuses | Coverage |
|-----|----------|----------|
| **Tampa** (45300) | 2 | Brandon + Tampa |
| **Orlando** (36740) | 2 | Orlando + Sanford |
| **Cape Coral-Fort Myers** (15980) | 1 | Fort Myers |
| **Lakeland** (29460) | 1 | Auburndale |
| **Punta Gorda** (39460) | 1 | Port Charlotte |

**5 of 21 MSAs** have STC presence (24%)

## ✅ Success Criteria Met

- [x] 7 campuses added with accurate coordinates
- [x] Clustering enabled (max zoom 14, radius 50px)
- [x] Click handlers for campuses and clusters
- [x] Popup shows name, address, website link
- [x] Markers styled with blue color + 🎓 icon
- [x] Non-invasive (doesn't affect MSA UI)
- [x] Legend explains blue markers
- [x] Hover effects on markers
- [x] External links open in new tab

## 🚀 Future Enhancements (Optional)

- Toggle campus layer on/off
- Add other educational institutions
- Filter campuses by programs offered
- Show distance from selected MSA
- Add campus photos to popup

---

**Status**: ✅ Complete and Ready  
**Campuses**: 7 locations  
**Integration**: Non-invasive overlay  
**Test**: http://localhost:3000 🎓

