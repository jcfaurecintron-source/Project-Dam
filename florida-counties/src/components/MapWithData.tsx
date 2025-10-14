'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { 
  loadLaborStatistics, 
  getAllSocCodes,
  getCombinedData,
  formatWage,
  formatEmployment,
  formatPercent
} from '@/lib/data-loaders';
import type { CountyOews, StateProjection, SocMap } from '@/lib/types';

const MapWithData = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data state
  const [oewsData, setOewsData] = useState<CountyOews[]>([]);
  const [projectionsData, setProjectionsData] = useState<StateProjection[]>([]);
  const [socMap, setSocMap] = useState<SocMap | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Filter state
  const [selectedSoc, setSelectedSoc] = useState<string>('29-1141'); // Default: Registered Nurses
  const [selectedMetric, setSelectedMetric] = useState<'employment' | 'meanWage' | 'medianWage'>('employment');

  // Load labor statistics data
  useEffect(() => {
    loadLaborStatistics(2023)
      .then((data) => {
        setOewsData(data.oews);
        setProjectionsData(data.projections);
        setSocMap(data.socMap);
        setDataLoaded(true);
        console.log('📊 Labor statistics loaded:', {
          oews: data.oews.length,
          projections: data.projections.length,
        });
      })
      .catch((err) => {
        console.error('Failed to load labor statistics:', err);
        setError('Failed to load labor statistics data');
      });
  }, []);

  // Initialize map
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
        center: [-81.5158, 27.9944],
        zoom: 6.5,
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('Map error:', e);
        setError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });

      map.on('load', () => {
        console.log('Map loaded successfully');
        setMapLoaded(true);
        
        // Add source
        map.addSource('florida-counties', {
          type: 'geojson',
          data: '/florida-counties.geojson',
        });
        console.log('Added GeoJSON source');

        // Add fill layer with data-driven styling
        map.addLayer({
          id: 'counties-fill',
          type: 'fill',
          source: 'florida-counties',
          paint: {
            'fill-color': '#e0e0e0', // Default gray
            'fill-opacity': 0.6,
          },
        });
        console.log('Added fill layer');

        // Add outline layer
        map.addLayer({
          id: 'counties-outline',
          type: 'line',
          source: 'florida-counties',
          paint: {
            'line-color': '#666',
            'line-width': 1,
          },
        });
        console.log('Added outline layer');

        // Add hover highlight layer
        map.addLayer({
          id: 'counties-hover',
          type: 'line',
          source: 'florida-counties',
          paint: {
            'line-color': '#ff6600',
            'line-width': 3,
          },
          filter: ['==', 'NAME', ''],
        });
        console.log('Added hover layer');

        let hoveredCountyName: string | null = null;

        // Hover effect
        map.on('mousemove', 'counties-fill', (e) => {
          if (e.features && e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            
            const countyName = e.features[0].properties?.NAME;
            if (countyName && countyName !== hoveredCountyName) {
              hoveredCountyName = countyName;
              map.setFilter('counties-hover', ['==', 'NAME', countyName]);
            }
          }
        });

        map.on('mouseleave', 'counties-fill', () => {
          map.getCanvas().style.cursor = '';
          hoveredCountyName = null;
          map.setFilter('counties-hover', ['==', 'NAME', '']);
        });

        // Enhanced click handler with detailed data tooltip
        map.on('click', 'counties-fill', (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const countyName = feature.properties?.NAME;
            const geoid = feature.properties?.GEO_ID?.replace('0500000US', '');
            
            if (countyName && geoid) {
              // Get data for this county and SOC
              const data = getCombinedData(oewsData, projectionsData, geoid, selectedSoc);
              
              // Build popup HTML
              let html = `<div class="p-2">
                <h3 class="font-bold text-lg mb-2">${countyName} County</h3>`;
              
              if (data.oews) {
                html += `
                  <div class="mb-3">
                    <div class="text-sm font-semibold text-gray-700 mb-1">${data.oews.socTitle}</div>
                    <div class="space-y-1 text-sm">
                      <div><span class="font-medium">Employment:</span> ${formatEmployment(data.oews.employment)}</div>
                      <div><span class="font-medium">Mean Wage:</span> ${formatWage(data.oews.meanWage)}</div>
                      <div><span class="font-medium">Median Wage:</span> ${formatWage(data.oews.medianWage)}</div>
                    </div>
                  </div>`;
              } else {
                html += `<div class="text-sm text-gray-500 mb-3">No employment data available for this county</div>`;
              }
              
              if (data.projection) {
                html += `
                  <div class="border-t pt-2">
                    <div class="text-xs font-semibold text-gray-600 mb-1">Florida Statewide Outlook</div>
                    <div class="space-y-1 text-xs">
                      <div><span class="font-medium">Growth (${data.projection.baseYear}-${data.projection.projectionYear}):</span> ${formatPercent(data.projection.employmentChangePercent)}</div>
                      <div><span class="font-medium">Annual Openings:</span> ${formatEmployment(data.projection.annualOpenings)}</div>
                    </div>
                  </div>`;
              }
              
              html += '</div>';
              
              new mapboxgl.Popup({ maxWidth: '300px' })
                .setLngLat(e.lngLat)
                .setHTML(html)
                .addTo(map);
            }
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
  }, []);

  // Update choropleth when data or filters change
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !dataLoaded || oewsData.length === 0) return;

    console.log('Updating choropleth for SOC:', selectedSoc, 'Metric:', selectedMetric);

    // Filter data for selected SOC
    const socData = oewsData.filter((d) => d.soc === selectedSoc);
    console.log('Filtered data points:', socData.length);

    // Calculate color scale
    const values = socData
      .map((d) => {
        if (selectedMetric === 'employment') return d.employment;
        if (selectedMetric === 'meanWage') return d.meanWage;
        if (selectedMetric === 'medianWage') return d.medianWage;
        return null;
      })
      .filter((v) => v !== null) as number[];

    if (values.length === 0) {
      console.log('No valid data for choropleth');
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    console.log('Value range:', { min, max });

    // Build color expression for Mapbox
    const colorExpression: any = [
      'case',
      ['==', ['get', 'GEO_ID'], ''], // Fallback condition
      '#e0e0e0',
    ];

    socData.forEach((d) => {
      const value = selectedMetric === 'employment' ? d.employment :
                    selectedMetric === 'meanWage' ? d.meanWage :
                    d.medianWage;
      
      if (value !== null) {
        const geoid = d.geoid;
        const normalized = (value - min) / (max - min);
        
        // Color scale: light blue to dark blue
        const color = interpolateColor(normalized);
        
        colorExpression.push(['==', ['get', 'GEO_ID'], `0500000US${geoid}`]);
        colorExpression.push(color);
      }
    });

    colorExpression.push('#e0e0e0'); // Default color

    // Update fill color
    mapRef.current.setPaintProperty('counties-fill', 'fill-color', colorExpression);
    
  }, [mapLoaded, dataLoaded, oewsData, selectedSoc, selectedMetric]);

  // Color interpolation helper
  function interpolateColor(t: number): string {
    // Blue scale: light (#e3f2fd) to dark (#0d47a1)
    const r = Math.round(227 - t * 214); // 227 -> 13
    const g = Math.round(242 - t * 171); // 242 -> 71
    const b = Math.round(253 - t * 92);  // 253 -> 161
    return `rgb(${r},${g},${b})`;
  }

  const socCodes = socMap ? getAllSocCodes(socMap) : [];

  return (
    <div className="relative w-screen h-screen" style={{ width: '100vw', height: '100vh' }}>
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0" 
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-lg">
            <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
            <p className="text-gray-700">{error}</p>
          </div>
        </div>
      )}
      {(!mapLoaded || !dataLoaded) && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">
              {!mapLoaded ? 'Loading map...' : 'Loading labor statistics...'}
            </p>
          </div>
        </div>
      )}
      {mapLoaded && dataLoaded && (
        <>
          {/* Info Panel */}
          <div className="absolute top-4 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-10 max-w-sm">
            <h1 className="text-xl font-bold text-gray-800">Florida Counties</h1>
            <p className="text-sm text-gray-600 mb-3">Employment & Wage Data</p>
            
            {/* SOC Dropdown */}
            <div className="mb-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Occupation
              </label>
              <select
                value={selectedSoc}
                onChange={(e) => setSelectedSoc(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {socCodes.map((soc) => (
                  <option key={soc.soc} value={soc.soc}>
                    {soc.name} ({soc.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Metric Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Display Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="employment">Employment</option>
                <option value="meanWage">Mean Wage</option>
                <option value="medianWage">Median Wage</option>
              </select>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-8 left-4 bg-white px-4 py-3 rounded-lg shadow-lg z-10">
            <div className="text-xs font-semibold text-gray-700 mb-2">
              {selectedMetric === 'employment' ? 'Employment Level' :
               selectedMetric === 'meanWage' ? 'Mean Annual Wage' :
               'Median Annual Wage'}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Low</span>
              <div className="flex h-4 w-32">
                {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
                  <div
                    key={i}
                    className="flex-1"
                    style={{ backgroundColor: interpolateColor(t) }}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-600">High</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MapWithData;

