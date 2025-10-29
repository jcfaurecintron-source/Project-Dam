'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import InsightPanel from './InsightPanel';
import { mapOewsToIpedsMsaName } from '../src/lib/msa-name-mapping';

// OEWS 2024 Data Types
interface OewsRecord {
  msa_code: string;
  msa_name: string;
  soc: string;
  employment: number | null;
  median_annual: number | null;
  mean_annual: number | null;
  p10_annual: number | null;
  p25_annual: number | null;
  p75_annual: number | null;
  p90_annual: number | null;
  year: number;
}

// OEWS Series Data (Historical Employment)
interface OewsSeriesRecord {
  msa_code: string;
  msa_name: string;
  soc: string;
  employment_by_year: Record<string, number | null>;
  yoy_abs: number | null;
  yoy_pct: number | null;
  abs_3y: number | null;
  pct_3y: number | null;
  cagr_3y: number | null;
  trend_yoy: 'Up' | 'Down' | 'Flat' | null;
  trend_3y: 'Up' | 'Down' | 'Flat' | null;
  latest_year: number;
}

// InsightPanel Data Type
interface InsightPanelData {
  scope: 'MSA' | 'State';
  msaCode: string;
  msaName: string;
  soc: string;
  year: number;
  employment: number | null;
  medianAnnual: number | null;
  meanAnnual: number | null;
  p10Annual: number | null;
  p25Annual?: number | null;
  p75Annual?: number | null;
  p90Annual: number | null;
  // Growth metrics (from employment history)
  yoyAbs?: number | null;
  yoyPct?: number | null;
  trendYoy?: 'Up' | 'Down' | 'Flat' | null;
  abs3y?: number | null;
  pct3y?: number | null;
  cagr3y?: number | null;
  trend3y?: 'Up' | 'Down' | 'Flat' | null;
  // Employment time series for sparkline
  employmentByYear?: Record<string, number | null>;
  // Institution count (from IPEDS)
  institutionCount?: number | null;
  // Competition density (institutions per 100k population)
  competitionDensity?: number | null;
  msaPopulation?: number | null;
}

// IPEDS Institution Data Type
interface InstitutionData {
  msa: string;
  count: number;
}

// Competition Density Data Type
interface CompetitionDensityData {
  msa_code: string;
  msa_name: string;
  census_name: string;
  institution_count: number;
  population: number;
  competition_density: number;
  institutions_per_100k: number;
}

const MapLive = () => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for selected SOC and OEWS data
  const [selectedSoc, setSelectedSoc] = useState<string>('29-1141'); // Default: Registered Nurses
  const oewsDataRef = useRef<OewsRecord[]>([]);
  const oewsSeriesRef = useRef<OewsSeriesRecord[]>([]);
  const institutionsDataRef = useRef<Record<string, number>>({});
  const competitionDensityRef = useRef<Record<string, CompetitionDensityData>>({});
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // InsightPanel state
  const [panelData, setPanelData] = useState<InsightPanelData | null>(null);
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | undefined>();
  const [panelLoading, setPanelLoading] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Load OEWS 2024 data and series data
  useEffect(() => {
    const loadOewsData = async () => {
      try {
        // Load current year wages
        const response = await fetch('/data/oews_fl_msa_2024.json');
        if (response.ok) {
          const data = await response.json();
          oewsDataRef.current = data;
          console.log(`✅ Loaded ${data.length} OEWS 2024 records`);
        } else {
          console.error('Failed to load OEWS 2024 data');
        }

        // Load historical employment series
        const seriesResponse = await fetch('/data/oews_fl_msa_series.json');
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json();
          oewsSeriesRef.current = seriesData;
          console.log(`✅ Loaded ${seriesData.length} OEWS series records`);
        } else {
          console.warn('Historical series data not available');
        }

        // Load institution counts from IPEDS
        const institutionsResponse = await fetch('/data/institutions_fl.json');
        if (institutionsResponse.ok) {
          const institutionsData = await institutionsResponse.json();
          // Convert array to map for faster lookup
          const msaCounts: Record<string, number> = {};
          if (institutionsData.msa_counts) {
            Object.entries(institutionsData.msa_counts).forEach(([msaName, count]) => {
              msaCounts[msaName] = count as number;
            });
          }
          institutionsDataRef.current = msaCounts;
          console.log(`✅ Loaded institution counts for ${Object.keys(msaCounts).length} MSAs`);
        } else {
          console.warn('Institution data not available');
        }

        // Load competition density data
        const densityResponse = await fetch('/data/msa_competition_density.json');
        if (densityResponse.ok) {
          const densityData = await densityResponse.json();
          // Convert to map for faster lookup by MSA name
          const densityMap: Record<string, CompetitionDensityData> = {};
          if (densityData.msas) {
            densityData.msas.forEach((msa: CompetitionDensityData) => {
              densityMap[msa.msa_name] = msa;
            });
          }
          competitionDensityRef.current = densityMap;
          console.log(`✅ Loaded competition density for ${Object.keys(densityMap).length} MSAs`);
        } else {
          console.warn('Competition density data not available');
        }


        setDataLoaded(true);
      } catch (err) {
        console.error('Error loading OEWS data:', err);
      }
    };
    loadOewsData();
  }, []);

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
        style: 'mapbox://styles/mapbox/streets-v12', // Colorful streets map
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

        // Click handler - Display OEWS 2024 MSA data in InsightPanel
        map.on('click', 'msas-fill', async (e) => {
          const f = e.features?.[0];
          if (!f) return;
          
          const msaCode = f.properties?.CBSAFP || '';
          const msaName = f.properties?.NAME || msaCode;
          
          if (!msaCode) return;

          // Convert map coordinates to screen position
          const point = map.project(e.lngLat);
          setPanelPosition({ x: point.x, y: point.y });
          setPanelLoading(true);
          setPanelError(null);

          // Find data for this MSA and SOC
          const record = oewsDataRef.current.find(
            r => r.msa_code === msaCode && r.soc === selectedSoc
          );

          if (record) {
            // Find growth data for this MSA×SOC
            const seriesRecord = oewsSeriesRef.current.find(
              r => r.msa_code === msaCode && r.soc === selectedSoc
            );

            // Get institution count and density for this MSA (map OEWS name to IPEDS name)
            const ipedsMsaName = mapOewsToIpedsMsaName(record.msa_name);
            const institutionCount = institutionsDataRef.current[ipedsMsaName] ?? null;
            const densityData = competitionDensityRef.current[ipedsMsaName];
            const competitionDensity = densityData?.institutions_per_100k ?? null;
            const msaPopulation = densityData?.population ?? null;


            // Convert to InsightPanel format with growth metrics
            const insightData: InsightPanelData = {
              scope: 'MSA',
              msaCode: record.msa_code,
              msaName: record.msa_name,
              soc: record.soc,
              year: record.year,
              employment: record.employment,
              medianAnnual: record.median_annual,
              meanAnnual: record.mean_annual,
              p10Annual: record.p10_annual,
              p25Annual: record.p25_annual,
              p75Annual: record.p75_annual,
              p90Annual: record.p90_annual,
              // Growth metrics from series data
              yoyAbs: seriesRecord?.yoy_abs ?? null,
              yoyPct: seriesRecord?.yoy_pct ?? null,
              trendYoy: seriesRecord?.trend_yoy ?? null,
              abs3y: seriesRecord?.abs_3y ?? null,
              pct3y: seriesRecord?.pct_3y ?? null,
              cagr3y: seriesRecord?.cagr_3y ?? null,
              trend3y: seriesRecord?.trend_3y ?? null,
              employmentByYear: seriesRecord?.employment_by_year ?? undefined,
              // Institution count from IPEDS
              institutionCount: institutionCount,
              // Competition density metrics
              competitionDensity: competitionDensity,
              msaPopulation: msaPopulation,
            };
            
            setPanelData(insightData);
            setPanelLoading(false);
            
            // Update feature state for choropleth
            if (record.median_annual !== null) {
              map.setFeatureState(
                { source: 'fl-msas', id: msaCode },
                { median: record.median_annual }
              );
            }
          } else {
            // No data found - show error in panel
            setPanelError(`Data not available for ${msaName} (SOC ${selectedSoc}). BLS may have suppressed this data.`);
            setPanelLoading(false);
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

  // Handle panel close
  const handlePanelClose = () => {
    setPanelData(null);
    setPanelPosition(undefined);
    setPanelError(null);
  };


  // Update panel when SOC changes
  useEffect(() => {
    if (panelData && mapRef.current) {
      // Find updated record for current MSA with new SOC
      const record = oewsDataRef.current.find(
        r => r.msa_code === panelData.msaCode && r.soc === selectedSoc
      );
      
      if (record) {
        // Find growth data for this MSA×SOC
        const seriesRecord = oewsSeriesRef.current.find(
          r => r.msa_code === panelData.msaCode && r.soc === selectedSoc
        );

        // Get institution count and density for this MSA (map OEWS name to IPEDS name)
        const ipedsMsaName = mapOewsToIpedsMsaName(record.msa_name);
        const institutionCount = institutionsDataRef.current[ipedsMsaName] ?? null;
        const densityData = competitionDensityRef.current[ipedsMsaName];
        const competitionDensity = densityData?.institutions_per_100k ?? null;
        const msaPopulation = densityData?.population ?? null;


        const insightData: InsightPanelData = {
          scope: 'MSA',
          msaCode: record.msa_code,
          msaName: record.msa_name,
          soc: record.soc,
          year: record.year,
          employment: record.employment,
          medianAnnual: record.median_annual,
          meanAnnual: record.mean_annual,
          p10Annual: record.p10_annual,
          p25Annual: record.p25_annual,
          p75Annual: record.p75_annual,
          p90Annual: record.p90_annual,
          // Growth metrics from series data
          yoyAbs: seriesRecord?.yoy_abs ?? null,
          yoyPct: seriesRecord?.yoy_pct ?? null,
          trendYoy: seriesRecord?.trend_yoy ?? null,
          abs3y: seriesRecord?.abs_3y ?? null,
          pct3y: seriesRecord?.pct_3y ?? null,
          cagr3y: seriesRecord?.cagr_3y ?? null,
          trend3y: seriesRecord?.trend_3y ?? null,
          employmentByYear: seriesRecord?.employment_by_year ?? undefined,
          // Institution count from IPEDS
          institutionCount: institutionCount,
          // Competition density metrics
          competitionDensity: competitionDensity,
          msaPopulation: msaPopulation,
        };
        setPanelData(insightData);
      } else {
        // No data for new SOC - show error
        setPanelError(`Data not available for this MSA with SOC ${selectedSoc}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSoc]);

  return (
    <div className="relative w-screen h-screen" style={{ width: '100vw', height: '100vh' }}>
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0" 
        style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
      />
      
      {/* InsightPanel */}
      <InsightPanel
        data={panelData}
        position={panelPosition}
        onClose={handlePanelClose}
        loading={panelLoading}
        error={panelError}
      />
      
      {/* SOC Selector - Professional */}
      {mapLoaded && (
        <div className="absolute z-10 top-4 left-4">
          <div className="bg-white rounded-lg shadow-lg border border-gray-300 overflow-hidden">
            {/* Label */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-gray-200">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Occupation
              </span>
            </div>
            
            {/* Dropdown */}
            <select
              value={selectedSoc}
              onChange={(e) => {
                setSelectedSoc(e.target.value);
              }}
              className="w-full px-4 py-3 bg-white text-sm font-medium text-gray-800 cursor-pointer border-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset hover:bg-gray-50 transition-colors appearance-none bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTIiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDEyIDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTEgMUw2IDZMMTEgMSIgc3Ryb2tlPSIjNkI3MjgwIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPjwvc3ZnPg==')] bg-[length:12px] bg-[position:right_1rem_center] bg-no-repeat pr-10"
              style={{ minWidth: '340px' }}
            >
              {/* Healthcare Occupations */}
              <optgroup label="Healthcare Occupations">
                <option value="29-1141">Registered Nurses</option>
                <option value="29-2032">Diagnostic Medical Sonographers</option>
                <option value="31-9092">Medical Assistants</option>
                <option value="29-2055">Surgical Technologists</option>
                <option value="31-9096">Veterinary Assistants</option>
              </optgroup>
              
              {/* Skilled Trades */}
              <optgroup label="Skilled Trades">
                <option value="47-2111">Electricians</option>
                <option value="49-9021">HVAC Mechanics</option>
                <option value="51-4121">Welders</option>
              </optgroup>
            </select>
            
            {/* Footer hint */}
            <div className="px-4 py-2 bg-slate-50 border-t border-gray-200">
              <p className="text-xs text-gray-600 font-medium">
                Select to view occupation-specific metrics
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Data Source Info */}
      {mapLoaded && dataLoaded && (
        <div className="absolute top-3 right-3 bg-white px-3 py-2 rounded shadow-lg z-10">
          <div className="text-xs text-gray-600 mb-1">Data source</div>
          <div className="font-semibold text-sm text-blue-600">BLS OEWS May 2024</div>
          <div className="text-xs text-gray-500">Official employment data</div>
        </div>
      )}

      {/* Info Panel */}
      {mapLoaded && (
        <div className="absolute bottom-4 left-3 bg-white px-4 py-3 rounded-lg shadow-lg z-10 max-w-xs">
          <div className="text-sm font-semibold text-gray-800 mb-1">Florida MSAs</div>
          <div className="text-xs text-gray-600 mb-2">
            21 Metropolitan Statistical Areas
          </div>
          <div className="text-xs text-gray-500 mb-3">
            • 8 occupations available<br/>
            • Click any MSA for wage data (May 2024)<br/>
            • White borders separate regions<br/>
            • {oewsDataRef.current.length} total records loaded
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
