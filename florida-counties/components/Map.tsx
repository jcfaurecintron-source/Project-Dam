'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Type definitions
type Soc = string;
type GeoId = string;
type CountyOews = { 
  geoid: GeoId; 
  countyName: string;
  soc: Soc; 
  year: number; 
  employment: number | null;
  meanWage: number | null;
  medianWage: number | null;
};

// Load county OEWS data
async function loadCountyOEWS(year: number): Promise<CountyOews[]> {
  const r = await fetch(`/data/oews_fl_county_${year}.json`, { cache: 'no-store' });
  return r.ok ? r.json() : [];
}

const Map = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for selected SOC and employment lookup
  const [selectedSoc, setSelectedSoc] = useState<Soc>('29-1141'); // Default: Registered Nurses
  const employmentByGeo = useRef(new (globalThis.Map)<GeoId, number>());
  const oewsData = useRef<CountyOews[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current) {
      console.log('Map container ref not available');
      return;
    }
    if (mapRef.current) return; // Prevent re-initialization

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    console.log('Mapbox token available:', token ? 'Yes' : 'No');
    
    if (!token) {
      const errorMsg = 'Mapbox token is missing';
      console.error(errorMsg);
      setError(errorMsg);
      return;
    }
    mapboxgl.accessToken = token;

    try {
      console.log('Initializing map...');
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
        
        // Add source with promoteId to enable feature-state
        map.addSource('fl-counties', {
          type: 'geojson',
          data: '/florida-counties.geojson',
          promoteId: 'GEO_ID', // Use GEO_ID property as feature ID
        });
        console.log('Added GeoJSON source');

        // Load OEWS data
        const year = 2023;
        const rows = await loadCountyOEWS(year);
        oewsData.current = rows;
        console.log(`Loaded ${rows.length} OEWS records`);

        // Build employment lookup
        function rebuildLookup() {
          employmentByGeo.current.clear();
          rows
            .filter(r => r.soc === selectedSoc)
            .forEach(r => {
              if (r.employment != null) {
                employmentByGeo.current.set(r.geoid, r.employment);
              }
            });
          console.log(`Rebuilt lookup for SOC ${selectedSoc}: ${employmentByGeo.current.size} counties`);
        }

        rebuildLookup();

        // Add fill layer with data-driven coloring
        map.addLayer({
          id: 'fl-fill',
          type: 'fill',
          source: 'fl-counties',
          paint: {
            'fill-color': [
              'interpolate', 
              ['linear'],
              ['coalesce', ['feature-state', 'metric'], 0],
              0, '#edf2f7',
              50, '#c6dbef',
              200, '#9ecae1',
              500, '#6baed6',
              1000, '#4292c6',
              2000, '#2171b5',
              4000, '#084594'
            ],
            'fill-opacity': 0.7,
          },
        });
        console.log('Added fill layer');

        // Add outline layer
        map.addLayer({
          id: 'fl-outline',
          type: 'line',
          source: 'fl-counties',
          paint: {
            'line-color': '#333',
            'line-width': 1,
          },
        });

        // Set initial feature states
        const geojsonResponse = await fetch('/florida-counties.geojson');
        const geojson = await geojsonResponse.json();
        
        geojson.features.forEach((feature: any) => {
          const geoid = feature.properties.GEO_ID?.replace('0500000US', '') || '';
          const employment = employmentByGeo.current.get(geoid) ?? 0;
          if (geoid) {
            map.setFeatureState(
              { source: 'fl-counties', id: feature.properties.GEO_ID },
              { metric: employment }
            );
          }
        });

        // Click handler → popup with employment
        map.on('click', 'fl-fill', (e) => {
          const f = e.features?.[0];
          if (!f) return;
          
          const geoId = f.properties?.GEO_ID?.replace('0500000US', '') || '';
          const name = f.properties?.NAME as string;
          const employment = employmentByGeo.current.get(geoId) ?? 0;
          
          // Get additional data from OEWS
          const countyData = oewsData.current.find(
            r => r.geoid === geoId && r.soc === selectedSoc
          );

          const meanWage = countyData?.meanWage 
            ? `$${Math.round(countyData.meanWage).toLocaleString()}`
            : 'N/A';
          const medianWage = countyData?.medianWage
            ? `$${Math.round(countyData.medianWage).toLocaleString()}`
            : 'N/A';

          new mapboxgl.Popup({ closeButton: true })
            .setLngLat(e.lngLat)
            .setHTML(`
              <div style="font-family: system-ui; font-size:14px; padding: 8px; color: #1a1a1a;">
                <div style="font-weight:600; font-size: 16px; margin-bottom: 8px; color: #000;">${name} County</div>
                <div style="font-size: 12px; color: #333; margin-bottom: 8px;">SOC: ${selectedSoc}</div>
                <div style="margin-top:4px; color: #1a1a1a;"><strong>Employment:</strong> ${Math.round(employment).toLocaleString()}</div>
                <div style="margin-top:4px; color: #1a1a1a;"><strong>Mean Wage:</strong> ${meanWage}</div>
                <div style="margin-top:4px; color: #1a1a1a;"><strong>Median Wage:</strong> ${medianWage}</div>
              </div>
            `)
            .addTo(map);
        });

        // Cursor affordance
        map.on('mouseenter', 'fl-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        
        map.on('mouseleave', 'fl-fill', () => {
          map.getCanvas().style.cursor = '';
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
  }, []);

  // Update map when SOC changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    const map = mapRef.current;
    console.log(`SOC changed to: ${selectedSoc}`);

    // Rebuild lookup for new SOC
    employmentByGeo.current.clear();
    oewsData.current
      .filter(r => r.soc === selectedSoc)
      .forEach(r => {
        if (r.employment != null) {
          employmentByGeo.current.set(r.geoid, r.employment);
        }
      });

    // Update feature-state metrics
    fetch('/florida-counties.geojson')
      .then(r => r.json())
      .then((geojson) => {
        geojson.features.forEach((feature: any) => {
          const geoid = feature.properties.GEO_ID?.replace('0500000US', '') || '';
          const employment = employmentByGeo.current.get(geoid) ?? 0;
          if (geoid) {
            map.setFeatureState(
              { source: 'fl-counties', id: feature.properties.GEO_ID },
              { metric: employment }
            );
          }
        });
        // Force repaint
        map.triggerRepaint();
      });
  }, [selectedSoc, mapLoaded]);

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
          onChange={(e) => setSelectedSoc(e.target.value)}
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

      {/* Legend */}
      {mapLoaded && (
        <div className="absolute bottom-8 left-3 bg-white px-4 py-3 rounded-lg shadow-lg z-10">
          <div className="text-xs font-semibold text-gray-700 mb-2">Employment Level</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Low</span>
            <div className="flex h-4 w-32">
              <div className="flex-1" style={{ backgroundColor: '#edf2f7' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#c6dbef' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#9ecae1' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#6baed6' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#4292c6' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#2171b5' }}></div>
              <div className="flex-1" style={{ backgroundColor: '#084594' }}></div>
            </div>
            <span className="text-xs text-gray-600">High</span>
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

export default Map;
