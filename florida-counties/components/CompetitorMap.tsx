"use client";

import { useEffect, useRef } from "react";
import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export default function CompetitorMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error("Mapbox token is missing");
      return;
    }
    mapboxgl.accessToken = token;

    try {
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [-81.7, 27.8],
        zoom: 6,
      });
      mapRef.current = map;

      map.on("error", (e) => {
        console.error("Map error:", e);
      });

      map.on("load", () => {
        setTimeout(() => {
          map.resize();
        }, 100);
      });

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, []);

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
  }, []);

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
