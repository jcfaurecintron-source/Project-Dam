'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { fetchOccupationData, formatWage } from '@/lib/careeronestop';
import type { OccupationData } from '@/lib/careeronestop';

const MapLive = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for selected SOC and wage cache
  const [selectedSoc, setSelectedSoc] = useState<string>('29-1141'); // Default: Registered Nurses
  const wageCache = useRef(new (globalThis.Map)<string, OccupationData>());

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError('Mapbox token is missing');
      return;
    }
    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-81.5158, 27.9944] as [number, number],
        zoom: 6.5,
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('Map error:', e);
        setError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });

      map.on('load', async () => {
        console.log('Map loaded successfully');
        setMapLoaded(true);
        
        // Add MSA source
        map.addSource('fl-msas', {
          type: 'geojson',
          data: '/data/fl-msas.geojson',
          promoteId: 'CBSAFP',
        });
        console.log('✅ Added MSA GeoJSON source');

        // Add fill layer with distinct colors per MSA
        map.addLayer({
          id: 'msas-fill',
          type: 'fill',
          source: 'fl-msas',
          paint: {
            'fill-color': [
              'match',
              ['get', 'CBSAFP'],
              // Major metros - blue shades
              '33100', '#4A90E2', // Miami - bright blue
              '45300', '#7B68EE', // Tampa - medium slate blue
              '36740', '#50C878', // Orlando - emerald
              '27260', '#FF6B6B', // Jacksonville - coral red
              // Mid-size metros - varied colors
              '15980', '#FFA07A', // Fort Myers - light salmon
              '35840', '#20B2AA', // Sarasota - light sea green
              '34940', '#DDA0DD', // Naples - plum
              '29460', '#F4A460', // Lakeland - sandy brown
              '37340', '#87CEEB', // Melbourne - sky blue
              '38940', '#98D8C8', // Port St. Lucie - teal
              // Smaller metros - pastels
              '23540', '#FFB6C1', // Gainesville - light pink
              '45220', '#DEB887', // Tallahassee - burlywood
              '19660', '#B0E0E6', // Daytona - powder blue
              '18880', '#F0E68C', // Crestview - khaki
              '37860', '#E6E6FA', // Pensacola - lavender
              '36100', '#FFDAB9', // Ocala - peach puff
              '42680', '#D8BFD8', // Vero Beach - thistle
              '39460', '#F5DEB3', // Punta Gorda - wheat
              '26140', '#AFEEEE', // Homosassa - pale turquoise
              '42700', '#FFE4B5', // Sebring - moccasin
              '48680', '#E0BBE4', // The Villages - light purple
              '#CCCCCC' // Default fallback
            ],
            'fill-opacity': 0.65,
          },
        });

        // Add outline layer with white borders for clarity
        map.addLayer({
          id: 'msas-outline',
          type: 'line',
          source: 'fl-msas',
          paint: {
            'line-color': '#FFFFFF',
            'line-width': 2,
          },
        });

        // Add hover highlight
        map.addLayer({
          id: 'msas-hover',
          type: 'line',
          source: 'fl-msas',
          paint: {
            'line-color': '#ff6600',
            'line-width': 3,
          },
          filter: ['==', 'CBSAFP', ''],
        });

        console.log('✅ Added MSA layers');

        // Fit to Florida MSAs
        const bounds = new mapboxgl.LngLatBounds();
        const geojson = await (await fetch('/data/fl-msas.geojson')).json();
        
        geojson.features.forEach((feature: any) => {
          const coords = getAllCoordinates(feature.geometry);
          coords.forEach(([lng, lat]) => bounds.extend([lng, lat]));
        });
        
        map.fitBounds(bounds, { padding: 40 });
        console.log('✅ Fitted bounds to Florida MSAs');

        let hoveredMsaCode: string | null = null;

        // Hover effect
        map.on('mousemove', 'msas-fill', (e) => {
          if (e.features && e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            const msaCode = e.features[0].properties?.CBSAFP;
            if (msaCode && msaCode !== hoveredMsaCode) {
              hoveredMsaCode = msaCode;
              map.setFilter('msas-hover', ['==', 'CBSAFP', msaCode]);
            }
          }
        });

        map.on('mouseleave', 'msas-fill', () => {
          map.getCanvas().style.cursor = '';
          hoveredMsaCode = null;
          map.setFilter('msas-hover', ['==', 'CBSAFP', '']);
        });

        // Click handler - Fetch LIVE MSA wage data
        map.on('click', 'msas-fill', async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          
          const msaCode = f.properties?.CBSAFP || '';
          const msaName = f.properties?.NAME || msaCode;
          
          if (!msaCode) return;

          // Check cache first
          const cacheKey = `${selectedSoc}-${msaCode}`;
          if (wageCache.current.has(cacheKey)) {
            console.log(`💾 Using cached data for ${msaCode}`);
            showPopup(map, e.lngLat, msaName, msaCode, wageCache.current.get(cacheKey)!);
            return;
          }

          // Show loading popup
          const loadingPopup = new mapboxgl.Popup({ closeButton: true })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: system-ui; padding: 16px; color: #1a1a1a;">
                <div style="font-weight:600; font-size: 16px; margin-bottom: 8px; color: #000;">${msaName}</div>
                <div style="font-size: 12px; color: #333; margin-bottom: 8px;">MSA Code: ${msaCode}</div>
                <div style="font-size: 12px; color: #333; margin-bottom: 8px;">SOC: ${selectedSoc}</div>
                <div style="margin-top: 12px;">
                  <div style="display: inline-block; width: 20px; height: 20px; border: 3px solid #3b82f6; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                  <span style="margin-left: 8px; color: #666;">Fetching live wage data...</span>
                </div>
                <style>
                  @keyframes spin { to { transform: rotate(360deg); } }
                </style>
              </div>
            `)
            .addTo(map);

          // Extract city name for API call
          const cityMatch = msaName.match(/^([^-,]+)/);
          const city = cityMatch ? cityMatch[1].trim() : msaName.split(',')[0];
          const location = `${city}, FL`;

          console.log(`📡 Fetching ${selectedSoc} for MSA ${msaCode} (${location})`);

          // Fetch live data from CareerOneStop
          const data = await fetchOccupationData(selectedSoc, location, msaCode);

          if (data) {
            wageCache.current.set(cacheKey, data);
            showPopup(map, e.lngLat, msaName, msaCode, data);
            
            // Update feature state for choropleth
            map.setFeatureState(
              { source: 'fl-msas', id: msaCode },
              { median: data.medianAnnual || 0 }
            );
          } else {
            loadingPopup.setHTML(`
              <div style="font-family: system-ui; padding: 16px; color: #1a1a1a;">
                <div style="font-weight:600; font-size: 16px; margin-bottom: 8px; color: #000;">${msaName}</div>
                <div style="font-size: 12px; color: #333; margin-bottom: 8px;">SOC: ${selectedSoc}</div>
                <div style="color: #dc2626; margin-top: 12px;">
                  ⚠️ Wage data unavailable for this MSA/occupation
                </div>
              </div>
            `);
          }
        });
      });
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(`Failed to initialize map: ${err}`);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [selectedSoc]);

  return (
    <div className="relative w-screen h-screen" style={{ width: '100vw', height: '100vh' }}>
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0" 
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
      
      {/* SOC Selector */}
      {mapLoaded && (
        <select
          value={selectedSoc}
          onChange={(e) => {
            setSelectedSoc(e.target.value);
            wageCache.current.clear(); // Clear cache on SOC change
          }}
          className="absolute z-10 top-3 left-3 bg-white border border-gray-300 rounded px-3 py-2 shadow-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="29-1141">Registered Nurses (29-1141)</option>
          <option value="29-2061">Licensed Practical Nurses (29-2061)</option>
          <option value="31-1131">Nursing Assistants (31-1131)</option>
          <option value="31-9092">Medical Assistants (31-9092)</option>
          <option value="31-2021">Physical Therapist Assistants (31-2021)</option>
          <option value="29-2052">Pharmacy Technicians (29-2052)</option>
          <option value="29-2012">Medical Laboratory Technicians (29-2012)</option>
          <option value="29-2034">Radiologic Technologists (29-2034)</option>
          <option value="29-2055">Surgical Technologists (29-2055)</option>
          <option value="47-2111">Electricians (47-2111)</option>
          <option value="47-2152">Plumbers (47-2152)</option>
          <option value="49-9021">HVAC Technicians (49-9021)</option>
          <option value="51-4121">Welders (51-4121)</option>
          <option value="47-2031">Carpenters (47-2031)</option>
          <option value="49-3023">Automotive Service Technicians (49-3023)</option>
          <option value="29-2056">Veterinary Technologists (29-2056)</option>
          <option value="31-9096">Veterinary Assistants (31-9096)</option>
        </select>
      )}

      {/* CareerOneStop Logo */}
      {mapLoaded && (
        <div className="absolute top-3 right-3 bg-white px-3 py-2 rounded shadow-lg z-10">
          <div className="text-xs text-gray-600 mb-1">Data provided by</div>
          <div className="font-semibold text-sm text-blue-600">CareerOneStop</div>
          <div className="text-xs text-gray-500">Sponsored by U.S. DOL</div>
        </div>
      )}

      {/* Info Panel */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-3 bg-white px-4 py-3 rounded-lg shadow-lg z-10 max-w-xs">
          <div className="text-sm font-semibold text-gray-800 mb-1">Florida MSAs</div>
          <div className="text-xs text-gray-600 mb-2">
            21 Metropolitan Statistical Areas
          </div>
          <div className="text-xs text-gray-500">
            • Each MSA has a distinct color<br/>
            • Click any MSA for live wage data<br/>
            • White borders separate regions
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-700">{error}</p>
          </div>
        </div>
      )}
      
      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to show popup with data
function showPopup(
  map: mapboxgl.Map,
  lngLat: mapboxgl.LngLat,
  msaName: string,
  msaCode: string,
  data: OccupationData
) {
  // Determine scope from area name
  const isState = data.areaName.includes('Statewide') || data.areaCode === 'FL';
  const scopeBadge = isState ? 'State' : 'MSA';
  const scopeColor = isState ? '#f59e0b' : '#10b981';

  new mapboxgl.Popup({ closeButton: true, maxWidth: '340px' })
    .setLngLat(lngLat)
    .setHTML(`
      <div style="font-family: system-ui; padding: 16px; color: #1a1a1a;">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
          <div style="font-weight:600; font-size: 18px; color: #000; flex: 1;">${msaName}</div>
          <div style="background: ${scopeColor}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 600; margin-left: 8px; white-space: nowrap;">
            ${scopeBadge}
          </div>
        </div>
        <div style="font-size: 11px; color: #666; margin-bottom: 12px;">${data.areaName}</div>
        
        <div style="background: #f3f4f6; padding: 8px; border-radius: 4px; margin-bottom: 12px;">
          <div style="font-size: 13px; font-weight: 600; color: #374151;">${data.socTitle}</div>
          <div style="font-size: 11px; color: #6b7280;">SOC: ${data.soc}</div>
        </div>
        
        <div style="margin-bottom: 8px;">
          <div style="font-size: 13px; color: #1a1a1a; margin-bottom: 6px; font-weight: 600;">
            <strong>Median:</strong> ${formatWage(data.medianAnnual)}<span style="font-size: 10px; color: #6b7280;">/year</span>
          </div>
          <div style="font-size: 12px; color: #4b5563; margin-bottom: 4px;">
            <strong>Mean:</strong> ${formatWage(data.meanAnnual)}<span style="font-size: 10px; color: #6b7280;">/year</span>
          </div>
        </div>
        
        ${data.p10 || data.p90 ? `
          <div style="border-top: 1px solid #e5e7eb; padding-top: 8px; margin-top: 8px;">
            <div style="font-size: 11px; font-weight: 600; color: #6b7280; margin-bottom: 4px;">Annual Wage Percentiles</div>
            ${data.p10 ? `<div style="font-size: 11px; color: #4b5563;">10th: ${formatWage(data.p10)}</div>` : ''}
            ${data.p25 ? `<div style="font-size: 11px; color: #4b5563;">25th: ${formatWage(data.p25)}</div>` : ''}
            ${data.p75 ? `<div style="font-size: 11px; color: #4b5563;">75th: ${formatWage(data.p75)}</div>` : ''}
            ${data.p90 ? `<div style="font-size: 11px; color: #4b5563;">90th: ${formatWage(data.p90)}</div>` : ''}
          </div>
        ` : ''}
        
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af;">
          <div style="display: flex; justify-content: space-between;">
            <span>Source: CareerOneStop</span>
            <span>${data.year} OEWS</span>
          </div>
          <div style="margin-top: 4px; font-weight: 600; color: #10b981;">🔴 LIVE DATA</div>
        </div>
      </div>
    `)
    .addTo(map);
}

// Helper to extract coordinates from geometry
function getAllCoordinates(geometry: any): [number, number][] {
  const coords: [number, number][] = [];
  
  function extract(g: any) {
    if (g.type === 'Polygon') {
      g.coordinates[0].forEach((c: [number, number]) => coords.push(c));
    } else if (g.type === 'MultiPolygon') {
      g.coordinates.forEach((poly: any) => {
        poly[0].forEach((c: [number, number]) => coords.push(c));
      });
    }
  }
  
  extract(geometry);
  return coords;
}

export default MapLive;
