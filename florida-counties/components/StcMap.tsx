"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, Marker, Popup } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { stcCampuses } from "./stcCampuses";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

type Geocode = { name: string; address: string; lng: number; lat: number };

interface GeocodedStudent {
  SyStudentID: number;
  StuNum: string;
  StudentName: string;
  CampusDescrip: string;
  Phone: string | null;
  ProgramDescrip: string;
  Addr1: string | null;
  SCITY: string | null;
  STATE: string | null;
  ZIP: string | null;
  lng: number | null;
  lat: number | null;
  geocoded: boolean;
}

async function geocodeAddress(addr: string) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    addr
  )}.json?access_token=${mapboxgl.accessToken}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocode HTTP ${res.status}`);
  const data = await res.json();
  const feat = data.features?.[0];
  if (!feat) throw new Error("No result");
  const [lng, lat] = feat.center;
  return { lng, lat };
}

async function geocodeAll(withRetry = true): Promise<Geocode[]> {
  const out: Geocode[] = [];
  for (const c of stcCampuses) {
    let attempts = 0;
    while (true) {
      try {
        const { lng, lat } = await geocodeAddress(c.address);
        out.push({ ...c, lng, lat });
        break;
      } catch (e) {
        attempts += 1;
        if (!withRetry || attempts >= 3) {
          // fail safe: push a dummy coordinate (Orlando) to avoid breaking UI
          out.push({ ...c, lng: -81.379234, lat: 28.538336 });
          break;
        }
        await new Promise(r => setTimeout(r, 300 * 2 ** attempts));
      }
    }
  }
  return out;
}

export default function StcMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [points, setPoints] = useState<Geocode[] | null>(null);
  const [students, setStudents] = useState<GeocodedStudent[] | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const studentsByCampusRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const key = "stc:campus-geocodes:v1";
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) {
      setPoints(JSON.parse(cached));
    } else {
      geocodeAll().then(geo => {
        setPoints(geo);
        localStorage.setItem(key, JSON.stringify(geo));
      });
    }
  }, []);

  // Fetch student data
  useEffect(() => {
    const fetchStudents = async () => {
      setLoadingStudents(true);
      try {
        // Fetch students from 1 year ago to end of current year
        // Note: With 1 year of data, this may take 1-2 minutes to fetch and geocode
        const response = await fetch('/api/students?startDateDaysAgo=365&geocode=true');
        if (!response.ok) {
          // Try to get error details from response
          let errorMessage = `Failed to fetch students (${response.status} ${response.statusText})`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          } catch (e) {
            // If we can't parse JSON, use the status text
          }
          console.error('API Error:', errorMessage);
          throw new Error(errorMessage);
        }
        const data = await response.json();
        if (data.success && data.students) {
          setStudents(data.students);
        } else {
          console.warn('API returned success=false:', data);
        }
      } catch (error) {
        console.error('Error fetching students:', error);
        // Set students to empty array on error so UI doesn't break
        setStudents([]);
        // Show a user-friendly message
        if (error instanceof Error && error.message.includes('500')) {
          console.warn('⚠️ Anthology API returned 500 error. This might indicate:');
          console.warn('   - API token expired or invalid');
          console.warn('   - API endpoint changed');
          console.warn('   - Network/IP restrictions');
          console.warn('   - Please verify the PowerShell script still works');
        }
      } finally {
        setLoadingStudents(false);
      }
    };
    fetchStudents();
  }, []);

  const geojson = useMemo(() => {
    if (!points) return null;
    return {
      type: "FeatureCollection",
      features: points.map(p => ({
        type: "Feature",
        properties: { name: p.name, address: p.address },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    } as GeoJSON.FeatureCollection;
  }, [points]);

  // Create GeoJSON for student heatmap
  const studentGeojson = useMemo(() => {
    if (!students || !showHeatmap) return null;
    const geocodedStudents = students.filter(s => s.geocoded && s.lng !== null && s.lat !== null);
    if (geocodedStudents.length === 0) return null;
    
    return {
      type: "FeatureCollection",
      features: geocodedStudents.map(s => ({
        type: "Feature",
        properties: {
          studentName: s.StudentName,
          campus: s.CampusDescrip,
          program: s.ProgramDescrip,
        },
        geometry: {
          type: "Point",
          coordinates: [s.lng!, s.lat!],
        },
      })),
    } as GeoJSON.FeatureCollection;
  }, [students, showHeatmap]);

  // Resize map when container size changes (for tab switching)
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.resize();
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [points]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !geojson) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-81.7, 27.8],
      zoom: 6,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Ensure map resizes to container dimensions after a brief delay
      setTimeout(() => {
        map.resize();
      }, 100);
      map.addSource("stc-campuses", {
        type: "geojson",
        data: geojson,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "stc-campuses",
        filter: ["has", "point_count"],
        paint: {
          "circle-radius": ["step", ["get", "point_count"], 14, 10, 18, 25, 24],
          "circle-color": ["step", ["get", "point_count"], "#88c", 10, "#66a", 25, "#448"],
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "stc-campuses",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "stc-campuses",
        filter: ["!", ["has", "point_count"]],
        paint: { "circle-radius": 6, "circle-color": "#214" },
      });

      map.on("click", "clusters", e => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0].properties?.cluster_id;
        (map.getSource("stc-campuses") as any).getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: (features[0].geometry as any).coordinates, zoom });
        });
      });

      map.on("click", "unclustered", e => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates.slice();
        const { name, address } = f.properties as any;
        
        // Get student count for this campus (using ref to get latest value)
        const studentCount = studentsByCampusRef.current[name] || 0;
        const countText = studentCount > 0 
          ? `<br/><strong>Students: ${studentCount.toLocaleString()}</strong>`
          : '';
        
        const popupHtml = `<strong>${name}</strong><br/>${address}${countText}<br/><a target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address
        )}">Directions</a>`;
        new Popup().setLngLat(coords).setHTML(popupHtml).addTo(map);
      });

      map.on("mouseenter", "unclustered", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered", () => (map.getCanvas().style.cursor = ""));
    });

    return () => map.remove();
  }, [geojson]);

  // Add/update student heatmap layer
  useEffect(() => {
    if (!mapRef.current || !studentGeojson) return;
    const map = mapRef.current;

    // Wait for map to be loaded
    if (!map.loaded()) {
      map.once("load", () => updateStudentHeatmap());
    } else {
      updateStudentHeatmap();
    }

    function updateStudentHeatmap() {
      if (!studentGeojson) return; // Guard against null
      
      const sourceId = "students-heatmap";
      const source = map.getSource(sourceId);
      
      if (source) {
        // Update existing source
        (source as mapboxgl.GeoJSONSource).setData(studentGeojson);
      } else {
        // Add new source and layers
        map.addSource(sourceId, {
          type: "geojson",
          data: studentGeojson,
        });

        // Add heatmap layer
        map.addLayer({
          id: "students-heatmap",
          type: "heatmap",
          source: sourceId,
          maxzoom: 15,
          paint: {
            "heatmap-weight": 1,
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 0.6,
              9, 1,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0, "rgba(33,102,172,0)",
              0.2, "rgb(103,169,207)",
              0.4, "rgb(209,229,240)",
              0.6, "rgb(253,219,199)",
              0.8, "rgb(239,138,98)",
              1, "rgb(178,24,43)",
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0, 20,
              9, 30,
            ],
            "heatmap-opacity": showHeatmap ? 0.6 : 0,
          },
        });

        // Add point layer for individual students (optional, for clicking)
        map.addLayer({
          id: "students-points",
          type: "circle",
          source: sourceId,
          minzoom: 10,
          paint: {
            "circle-radius": 4,
            "circle-color": "#ff6b6b",
            "circle-opacity": showHeatmap ? 0.6 : 0,
            "circle-stroke-width": 1,
            "circle-stroke-color": "#fff",
          },
        });

        // Click handler for student points
        map.on("click", "students-points", (e) => {
          const f = e.features?.[0];
          if (!f) return;
          const coords = (f.geometry as any).coordinates.slice();
          const { studentName, campus, program } = f.properties as any;
          const popupHtml = `
            <strong>${studentName || "Student"}</strong><br/>
            Campus: ${campus || "Unknown"}<br/>
            Program: ${program || "Unknown"}
          `;
          new Popup().setLngLat(coords).setHTML(popupHtml).addTo(map);
        });

        map.on("mouseenter", "students-points", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "students-points", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // Update layer visibility
      if (map.getLayer("students-heatmap")) {
        map.setPaintProperty("students-heatmap", "heatmap-opacity", showHeatmap ? 0.6 : 0);
      }
      if (map.getLayer("students-points")) {
        map.setPaintProperty("students-points", "circle-opacity", showHeatmap ? 0.6 : 0);
      }
    }
  }, [studentGeojson, showHeatmap]);

  const geocodedStudentCount = students?.filter(s => s.geocoded).length || 0;
  const totalStudentCount = students?.length || 0;

  // Count students per campus
  const studentsByCampus = useMemo(() => {
    if (!students) return {} as Record<string, number>;
    const counts: Record<string, number> = {};
    students.forEach(student => {
      const campus = student.CampusDescrip || 'Unknown';
      counts[campus] = (counts[campus] || 0) + 1;
    });
    studentsByCampusRef.current = counts; // Update ref for click handler
    return counts;
  }, [students]);

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
      <div className="absolute left-3 top-3 z-10 rounded-xl bg-white/90 p-3 shadow max-h-[80vh] overflow-y-auto">
        <div className="mb-2 font-semibold">STC Campuses</div>
        <ul className="space-y-1 mb-4">
          {stcCampuses.map(c => (
            <li key={c.name}>
              <button
                className="text-sm underline"
                onClick={() => {
                  if (!points || !mapRef.current) return;
                  const p = points.find(x => x.name === c.name);
                  if (p) mapRef.current.flyTo({ center: [p.lng, p.lat], zoom: 14 });
                }}
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
        
        <div className="border-t pt-3 mt-3">
          <div className="mb-2 font-semibold">Student Heatmap</div>
          {loadingStudents ? (
            <div className="text-xs text-gray-600">Loading students...</div>
          ) : totalStudentCount === 0 ? (
            <div className="text-xs text-red-600">
              No students loaded. Check console for errors.
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-600 mb-2">
                {geocodedStudentCount} of {totalStudentCount} students geocoded
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={showHeatmap}
                  onChange={(e) => setShowHeatmap(e.target.checked)}
                  className="cursor-pointer"
                />
                <span>Show heatmap</span>
              </label>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

