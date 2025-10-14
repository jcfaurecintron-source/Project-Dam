'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const Map = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) {
      console.log('Map container ref not available');
      return;
    }
    if (mapRef.current) return; // Prevent re-initialization

    // Set Mapbox access token
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
      // Initialize map
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/light-v11',
        center: [-81.5158, 27.9944], // Center of Florida
        zoom: 6.5,
      });

      mapRef.current = map;

      map.on('error', (e) => {
        console.error('Map error:', e);
        setError(`Map error: ${e.error?.message || 'Unknown error'}`);
      });

      // Load Florida counties GeoJSON
      map.on('load', () => {
        console.log('Map loaded successfully');
        setMapLoaded(true);
        
        // Add source
        map.addSource('florida-counties', {
          type: 'geojson',
          data: '/florida-counties.geojson',
        });
        console.log('Added GeoJSON source');

        // Add fill layer
        map.addLayer({
          id: 'counties-fill',
          type: 'fill',
          source: 'florida-counties',
          paint: {
            'fill-color': '#0080ff',
            'fill-opacity': 0.4,
          },
        });
        console.log('Added fill layer');

        // Add outline layer
        map.addLayer({
          id: 'counties-outline',
          type: 'line',
          source: 'florida-counties',
          paint: {
            'line-color': '#0066cc',
            'line-width': 2,
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
          filter: ['==', 'NAME', ''], // Initially show nothing
        });
        console.log('Added hover layer');

        // Track hovered feature
        let hoveredCountyName: string | null = null;

        // Add hover effect with cursor change
        map.on('mousemove', 'counties-fill', (e) => {
          if (e.features && e.features.length > 0) {
            map.getCanvas().style.cursor = 'pointer';
            
            const countyName = e.features[0].properties?.NAME;
            if (countyName && countyName !== hoveredCountyName) {
              hoveredCountyName = countyName;
              // Update filter to highlight hovered county
              map.setFilter('counties-hover', ['==', 'NAME', countyName]);
            }
          }
        });

        map.on('mouseleave', 'counties-fill', () => {
          map.getCanvas().style.cursor = '';
          hoveredCountyName = null;
          // Clear hover highlight
          map.setFilter('counties-hover', ['==', 'NAME', '']);
        });

        // Add click handler to show county info
        map.on('click', 'counties-fill', (e) => {
          if (e.features && e.features.length > 0) {
            const countyName = e.features[0].properties?.NAME;
            if (countyName) {
              new mapboxgl.Popup()
                .setLngLat(e.lngLat)
                .setHTML(`<strong>${countyName} County</strong>`)
                .addTo(map);
            }
          }
        });
      });
    } catch (err) {
      console.error('Error initializing map:', err);
      setError(`Failed to initialize map: ${err}`);
    }

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

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
      {!mapLoaded && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}
      {mapLoaded && (
        <div className="absolute top-4 left-4 bg-white px-4 py-2 rounded-lg shadow-lg z-10">
          <h1 className="text-xl font-bold text-gray-800">Florida Counties</h1>
          <p className="text-sm text-gray-600">67 counties highlighted</p>
        </div>
      )}
    </div>
  );
};

export default Map;

