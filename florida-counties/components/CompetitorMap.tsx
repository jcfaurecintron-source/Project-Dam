"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, { Map } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type ProgramInfo = {
  code: string;
  name: string;
};

type CostInfo = {
  tuitionInState: number | null;
  tuitionOutOfState: number | null;
  tuitionProgramYear: number | null;
  attendanceProgramYear: number | null;
  booksAndSupplies: number | null;
} | null;

type Competitor = {
  school_id: number;
  name: string;
  city?: string | null;
  state?: string | null;
  latitude: number | null;
  longitude: number | null;
  matching_programs: ProgramInfo[];
  website?: string | null;
  costs?: CostInfo;
};

export default function CompetitorMap() {
  const mapRef = useRef<Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [programOptions, setProgramOptions] = useState<ProgramInfo[]>([]);
  const [selectedProgramCode, setSelectedProgramCode] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [schoolQuery, setSchoolQuery] = useState("");

  useEffect(() => {
    const fetchCompetitors = async () => {
      try {
        setLoading(true);
        const response = await fetch("/api/competitors");
        if (!response.ok) {
          throw new Error(`Failed to load competitors (${response.status})`);
        }
        const data = await response.json();
        const competitorList: Competitor[] = Array.isArray(data?.competitors)
          ? (data.competitors as Competitor[])
          : [];
        setCompetitors(competitorList);

        if (Array.isArray(data?.program_catalog)) {
          const catalog = [...data.program_catalog] as ProgramInfo[];
          catalog.sort((a, b) => a.name.localeCompare(b.name));
          setProgramOptions(catalog);
        } else {
          const derived = new Map<string, ProgramInfo>();
          competitorList.forEach((comp: Competitor) => {
            (comp.matching_programs ?? []).forEach(program => {
              if (!derived.has(program.code)) {
                derived.set(program.code, program);
              }
            });
          });
          setProgramOptions(Array.from(derived.values()).sort((a, b) => a.name.localeCompare(b.name)));
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load competitor data");
      } finally {
        setLoading(false);
      }
    };

    fetchCompetitors();
  }, []);

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
        setMapReady(true);
        setTimeout(() => {
          map.resize();
        }, 100);
      });
    } catch (initError) {
      console.error("Error initializing map:", initError);
    }

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const schoolOptions = useMemo(() => {
    const unique = new Set<string>();
    competitors.forEach(comp => {
      const name = comp.name?.trim();
      if (name) unique.add(name);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [competitors]);

  const filteredCompetitors = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedSchool = schoolQuery.trim().toLowerCase();
    return competitors.filter(comp => {
      const programs = comp.matching_programs || [];
      const matchesProgram = !selectedProgramCode || programs.some(p => p.code === selectedProgramCode);
      const matchesSearch =
        !normalizedSearch ||
        programs.some(p => {
          const nameMatch = p.name?.toLowerCase().includes(normalizedSearch);
          const codeMatch = p.code?.toLowerCase().includes(normalizedSearch);
          return nameMatch || codeMatch;
        });
      const matchesSchool =
        !normalizedSchool || (comp.name ?? "").toLowerCase().includes(normalizedSchool);
      return matchesProgram && matchesSearch && matchesSchool;
    });
  }, [competitors, searchTerm, selectedProgramCode, schoolQuery]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null || Number.isNaN(value)) return "N/A";
    return `$${Math.round(value).toLocaleString()}`;
  };

  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    filteredCompetitors.forEach(comp => {
      if (typeof comp.longitude !== "number" || typeof comp.latitude !== "number") {
        return;
      }

      const programList = (comp.matching_programs ?? [])
        .map(program => `${program.name || `CIP ${program.code}`} (${program.code})`)
        .join("<br/>");
      const costs = comp.costs || null;
      const costContent = costs
        ? `
          <div style="margin-top:8px; font-size:12px; color:#1f2937;">
            <div><strong>In-state tuition:</strong> ${formatCurrency(costs.tuitionInState)}</div>
            <div><strong>Out-of-state tuition:</strong> ${formatCurrency(costs.tuitionOutOfState)}</div>
            <div><strong>Program-year tuition:</strong> ${formatCurrency(costs.tuitionProgramYear)}</div>
            <div><strong>Books & supplies:</strong> ${formatCurrency(costs.booksAndSupplies)}</div>
          </div>
        `
        : "";

      const popupHtml = `
        <div style="font-family: system-ui; font-size: 13px;">
          <div style="font-weight:600; margin-bottom:4px;">${comp.name}</div>
          <div style="color:#4b5563; margin-bottom:4px;">${[comp.city, comp.state].filter(Boolean).join(", ")}</div>
          <div style="font-size:12px; color:#111827; line-height:1.4;">${programList}</div>
          ${costContent}
          ${comp.website ? `<a href="${comp.website}" target="_blank" rel="noreferrer" style="color:#2563eb; font-size:12px; display:inline-block; margin-top:6px;">Visit website</a>` : ""}
        </div>
      `;

      const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml);
      const marker = new mapboxgl.Marker({ color: "#dc2626" })
        .setLngLat([comp.longitude, comp.latitude])
        .setPopup(popup)
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    });
  }, [filteredCompetitors, mapReady]);

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

  const handleFocus = (comp: Competitor) => {
    if (!mapRef.current || typeof comp.longitude !== "number" || typeof comp.latitude !== "number") return;
    mapRef.current.flyTo({
      center: [comp.longitude, comp.latitude],
      zoom: 8.5,
      essential: true,
    });
  };

  return (
    <div className="relative w-full h-full" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} className="absolute inset-0" style={{ width: '100%', height: '100%' }} />

      <div className="absolute left-3 top-3 z-10 w-80 max-w-[90vw] rounded-xl bg-white/95 p-4 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-800">Competitor Overview</div>
            <div className="text-xs text-gray-500">Live College Scorecard programs</div>
          </div>
          <div className="text-xs font-medium text-gray-600">
            {loading ? "Loading..." : `${filteredCompetitors.length} schools`}
          </div>
        </div>

        <div className="mt-3 space-y-2 text-xs text-gray-600">
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Filter by program / CIP
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={selectedProgramCode}
              onChange={e => setSelectedProgramCode(e.target.value)}
            >
              <option value="">All programs</option>
              {programOptions.map(program => (
                <option key={program.code} value={program.code}>
                  {program.name} ({program.code})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Search by school name
            <input
              type="text"
              value={schoolQuery}
              onChange={e => setSchoolQuery(e.target.value)}
              list="competitor-school-options"
              placeholder="Start typing a school name"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <datalist id="competitor-school-options">
              {schoolOptions.map(name => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="block text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Search program or CIP code
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="e.g. 51.0910 or Nursing"
              className="mt-1 w-full rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </label>
        </div>

        {error && (
          <div className="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-600">
            {error}
          </div>
        )}

        {!error && loading && (
          <div className="mt-3 text-xs text-gray-600">Loading competitor data...</div>
        )}

        {!error && !loading && filteredCompetitors.length === 0 && (
          <div className="mt-3 text-xs text-gray-600">
            No overlapping institutions detected for the selected CIP set.
          </div>
        )}

        {!error && !loading && filteredCompetitors.length > 0 && (
          <div className="mt-3 space-y-2 text-xs text-gray-600">
            <div>
              Highlighting Florida institutions sharing Southern Technical College CIP codes.
            </div>
            <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filteredCompetitors.map(comp => (
                <li
                  key={`${comp.school_id}-${comp.name}`}
                  className="rounded-lg border border-gray-200 bg-white/90 p-3 text-gray-800 shadow-sm transition hover:border-blue-300"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => handleFocus(comp)}
                  >
                    <div className="text-sm font-semibold text-gray-900">{comp.name}</div>
                    <div className="text-xs text-gray-500">
                      {[comp.city, comp.state].filter(Boolean).join(", ") || "Florida"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(comp.matching_programs ?? []).map(program => (
                        <span
                          key={`${comp.school_id}-${program.code}`}
                          className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700"
                        >
                          {program.name}
                          <span className="ml-1 text-[10px] font-normal text-blue-900">({program.code})</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 space-y-1 text-[11px] text-gray-600">
                      <div className="flex justify-between">
                        <span>In-state tuition</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(comp.costs?.tuitionInState ?? null)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Out-of-state tuition</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(comp.costs?.tuitionOutOfState ?? null)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Books & supplies</span>
                        <span className="font-semibold text-gray-900">
                          {formatCurrency(comp.costs?.booksAndSupplies ?? null)}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
