"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map, Marker, Popup } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { stcCampuses } from "./stcCampuses";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN as string;

type Geocode = { name: string; address: string; lng: number; lat: number };

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

  useEffect(() => {
    const key = "stc:campus-geocodes:v1";
    const cached = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (cached) {
      setPoints(JSON.parse(cached));
      return;
    }
    geocodeAll().then(geo => {
      setPoints(geo);
      localStorage.setItem(key, JSON.stringify(geo));
    });
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
        const popupHtml = `<strong>${name}</strong><br/>${address}<br/><a target="_blank" rel="noreferrer" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          address
        )}">Directions</a>`;
        new Popup().setLngLat(coords).setHTML(popupHtml).addTo(map);
      });

      map.on("mouseenter", "unclustered", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "unclustered", () => (map.getCanvas().style.cursor = ""));
    });

    return () => map.remove();
  }, [geojson]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="absolute left-3 top-3 z-10 rounded-xl bg-white/90 p-3 shadow">
        <div className="mb-2 font-semibold">STC Campuses</div>
        <ul className="space-y-1">
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
      </div>
    </div>
  );
}

