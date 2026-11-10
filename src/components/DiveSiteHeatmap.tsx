import { useEffect, useState, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { MABINI_OCEAN_TERRITORIAL_LINE, MABINI_MUNICIPAL_WATERS_POLYGON } from "@/lib/mabini-territory";

interface Site {
  id: string;
  name: string;
  barangay: string;
  depth: string;
  difficulty: string;
  type: string;
  status: string;
  dives: number;
  lat: number;
  lng: number;
}

// Single-hue blue system shared by heat glow and pins.
const BLUE_RAMP = ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8"];
const HEAT_GRADIENT: Record<number, string> = {
  0.25: "#dbeafe",
  0.5: "#93c5fd",
  0.75: "#3b82f6",
  1.0: "#1d4ed8",
};

// Approximate marine-zone radius drawn around Restricted-status sites.
// We hold points, not MPA boundaries, so zones are indicative, not legal.
const RESTRICTED_ZONE_METERS = 500;

function blueColor(t: number): string {
  if (t < 0.25) return BLUE_RAMP[0];
  if (t < 0.5) return BLUE_RAMP[1];
  if (t < 0.75) return BLUE_RAMP[2];
  return BLUE_RAMP[3];
}

// Crisp teardrop pin (SVG data-URI) — white center dot, white stroke,
// tip-anchored so the point lands exactly on the site coordinates.
function pinIcon(fill: string, height: number): L.Icon {
  const width = Math.round(height * 0.75);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 34">` +
    `<path d="M12 1C6 1 1.5 5.5 1.5 11.5 1.5 20 12 33 12 33S22.5 20 22.5 11.5C22.5 5.5 18 1 12 1z" ` +
    `fill="${fill}" stroke="#ffffff" stroke-width="1.8"/>` +
    `<circle cx="12" cy="11.5" r="4.2" fill="#ffffff"/>` +
    `</svg>`;
  return L.icon({
    iconUrl: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    iconSize: [width, height],
    iconAnchor: [Math.round(width / 2), height],
    popupAnchor: [0, -height + 6],
  });
}

// Escape admin-entered text before injecting it into Leaflet popup HTML.
function esc(value: string | number | null | undefined): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] ?? c,
  );
}

// Sea tint — no tile provider ships this exact water color, so the hue is
// applied as a blend layer confined to the tile pane. `color` blend keeps
// the tiles' luminance (roads/labels stay legible) while shifting land and
// water into a blue-grey monochrome; markers, heat, and popups live in
// higher panes and are untouched. Light mode only — dark tiles already
// read as sea.
const SEA_TINT = "#BCCCDC";

const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

interface TileConfig {
  url: string;
  attribution: string;
  subdomains: string;
  maxZoom: number;
}

function getTileConfig(dark: boolean): TileConfig {
  // CARTO raster tiles require an API key since Sep 2026 — without one they
  // render an "API key required" watermark. Key lives in VITE_CARTO_KEY
  // (.env local, Vercel env for deploys); absent key falls back to plain
  // OpenStreetMap so the map never breaks in any environment.
  const key = (import.meta.env.VITE_CARTO_KEY as string | undefined)?.trim();
  if (!key) {
    return {
      // OSM only serves a/b/c. Using d leaves every fourth tile blank.
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: OSM_ATTRIBUTION,
      subdomains: "abc",
      maxZoom: 19,
    };
  }
  // Voyager (not Positron) for the light style — its water is a muted
  // blue-grey that still reads as sea, keeping the monochrome look.
  return {
    url: dark
      ? `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${key}`
      : `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${key}`,
    attribution: TILE_ATTRIBUTION,
    subdomains: "abcd",
    maxZoom: 20,
  };
}

export function DiveSiteHeatmap({
  sites,
  onSiteClick,
}: {
  sites: Site[];
  onSiteClick?: (site: Site) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const tintRef = useRef<HTMLDivElement | null>(null);
  const heatRef = useRef<L.Layer | null>(null);
  const territoryRef = useRef<L.LayerGroup | null>(null);
  const [showTerritory, setShowTerritory] = useState(true);
  const fittedKeyRef = useRef<string>("");
  const sitesRef = useRef<Site[]>(sites);
  sitesRef.current = sites;
  const clickRef = useRef(onSiteClick);
  clickRef.current = onSiteClick;
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(
    () =>
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("dark"),
  );

  // Track dashboard theme so base tiles stay legible in both modes.
  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() =>
      setDark(el.classList.contains("dark")),
    );
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const center = useMemo(() => {
    if (sites.length === 0) return [13.75, 120.93] as [number, number];
    const lat = sites.reduce((a, s) => a + s.lat, 0) / sites.length;
    const lng = sites.reduce((a, s) => a + s.lng, 0) / sites.length;
    return [lat, lng] as [number, number];
  }, [sites]);

  // Identity of the site set — viewport refits only when the set itself
  // changes, not on every filter keystroke.
  const siteKey = useMemo(() => sites.map((s) => s.id).join("|"), [sites]);

  const diveRange = useMemo(() => {
    if (sites.length === 0) return { min: 0, max: 0 };
    const dives = sites.map((s) => s.dives);
    return { min: Math.min(...dives), max: Math.max(...dives) };
  }, [sites]);

  const uniform = diveRange.max <= diveRange.min;
  const norm = (dives: number) =>
    uniform ? 0.5 : (dives - diveRange.min) / (diveRange.max - diveRange.min);

  // Sea tint lives directly in the tile pane (below markers/heat/popups),
  // shown in light mode only.
  const syncSeaTint = (map: L.Map, darkMode: boolean) => {
    if (!darkMode) {
      if (!tintRef.current) {
        const el = L.DomUtil.create(
          "div",
          "sea-tint",
          map.getPanes().tilePane,
        ) as HTMLDivElement;
        el.style.cssText = `position:absolute;inset:0;background:${SEA_TINT};mix-blend-mode:color;opacity:.55;pointer-events:none;`;
        tintRef.current = el;
      }
    } else if (tintRef.current) {
      tintRef.current.remove();
      tintRef.current = null;
    }
  };

  // Initial map creation — run once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    const initialTiles = getTileConfig(
      document.documentElement.classList.contains("dark"),
    );
    const tiles = L.tileLayer(initialTiles.url, {
      attribution: initialTiles.attribution,
      subdomains: initialTiles.subdomains,
      maxZoom: initialTiles.maxZoom,
    }).addTo(map);
    tileRef.current = tiles;
    syncSeaTint(
      map,
      document.documentElement.classList.contains("dark"),
    );

    // Popup "View details" buttons are rendered as raw HTML — delegate
    // clicks back to the current onSiteClick via the live sites ref.
    map.on("popupopen", (e: L.PopupEvent) => {
      const btn = e.popup
        .getElement()
        ?.querySelector<HTMLButtonElement>("[data-site-idx]");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const site = sitesRef.current[Number(btn.dataset.siteIdx)];
        if (site) clickRef.current?.(site);
      });
    });

    mapRef.current = map;
    setReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      tintRef.current = null;
      heatRef.current = null;
      if (territoryRef.current) {
        map.removeLayer(territoryRef.current);
        territoryRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap base tiles when the dashboard theme changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const nextTiles = getTileConfig(dark);
    tileRef.current = L.tileLayer(nextTiles.url, {
      attribution: nextTiles.attribution,
      subdomains: nextTiles.subdomains,
      maxZoom: nextTiles.maxZoom,
    }).addTo(map);
    syncSeaTint(map, dark);
  }, [dark, ready]);

  // Sync heat layer, restricted zones, and clustered markers when
  // sites/filter changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous overlays (heat, zone circles, individual pins)
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }
    map.eachLayer((layer: unknown) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    if (sites.length > 0) {
      const heat = L.heatLayer(
        sites.map(
          (s) =>
            [s.lat, s.lng, uniform ? 0.6 : 0.25 + 0.75 * norm(s.dives)] as [
              number,
              number,
              number,
            ],
        ),
        { radius: 35, blur: 25, maxZoom: 15, gradient: HEAT_GRADIENT },
      ).addTo(map);
      heatRef.current = heat;
    }

    // Indicative restricted zones — dashed outline, translucent fill.
    sites
      .filter((s) => s.status === "Restricted")
      .forEach((s) => {
        L.circle([s.lat, s.lng], {
          radius: RESTRICTED_ZONE_METERS,
          color: "#ef4444",
          weight: 2,
          dashArray: "6 6",
          opacity: 0.9,
          fillColor: "#ef4444",
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);
      });

    // Every site gets its own pin — no merging. Busier sites render on
    // top (zIndexOffset) and zooming in separates adjacent pins.
    sites.forEach((site, idx) => {
      const t = Math.max(0, Math.min(1, norm(site.dives)));
      const restricted = site.status === "Restricted";
      const color = restricted ? "#ef4444" : blueColor(t);
      // Square-root scaling keeps busy reefs readable instead of towering
      // over their neighbours.
      const height = Math.round(26 + 14 * Math.sqrt(t));
      const idleIcon = pinIcon(color, height);
      const activeIcon = pinIcon(restricted ? "#b91c1c" : "#1e40af", height + 8);

      const marker = L.marker([site.lat, site.lng], {
        title: site.name,
        keyboard: true,
        riseOnHover: true,
        zIndexOffset: Math.round(t * 1000),
        icon: idleIcon,
        opacity: site.status === "Seasonal" ? 0.8 : 1,
      });

      marker.on("popupopen", () => marker.setIcon(activeIcon));
      marker.on("popupclose", () => marker.setIcon(idleIcon));

      marker.bindPopup(
        `<div style="font-family:Inter,sans-serif;min-width:180px;max-width:240px">` +
          `<div style="font-weight:700;font-size:14px;margin-bottom:2px">${esc(site.name)}</div>` +
          `<div style="font-size:11px;color:#64748b;font-family:monospace;margin-bottom:6px">${site.lat.toFixed(4)}, ${site.lng.toFixed(4)}</div>` +
          `<div style="font-size:12px;font-weight:600;color:#1d4ed8;margin-bottom:4px">${site.dives.toLocaleString()} dives</div>` +
          `<div style="font-size:11px;color:#475569;margin-bottom:1px">${esc(site.barangay)} · ${esc(site.type)}</div>` +
          `<div style="font-size:11px;color:#475569;margin-bottom:1px">Depth: ${esc(site.depth)} · ${esc(site.difficulty)}</div>` +
          `<div style="font-size:11px;color:#475569;margin-bottom:8px">Status: ${esc(site.status)}</div>` +
          (clickRef.current
            ? `<button data-site-idx="${idx}" style="width:100%;padding:7px 0;border-radius:8px;border:none;` +
              `background:linear-gradient(135deg,#3b82f6,#1d4ed8);color:#fff;` +
              `font:600 12px Inter,sans-serif;cursor:pointer;">View details</button>`
            : ``) +
          `</div>`,
        { closeButton: true, maxWidth: 250 },
      );

      marker.addTo(map);
    });

    // Refit only when the site set itself changes — not on every render —
    // so typing in the search filter doesn't yank the viewport.
    if (sites.length > 0 && fittedKeyRef.current !== siteKey) {
      fittedKeyRef.current = siteKey;
      map.fitBounds(
        sites.map((s) => [s.lat, s.lng] as [number, number]),
        { padding: [30, 30] },
      );
    }
    // Ensure proper size after data change (also handles tab becoming visible)
    setTimeout(() => map.invalidateSize(), 80);
  }, [sites, siteKey, uniform, diveRange]);

  useEffect(() => {
    if (mapRef.current) {
      // Initial invalidate after mount
      setTimeout(() => mapRef.current?.invalidateSize(), 150);
    }
  }, [ready]);

  // Re-invalidate when the container resizes or becomes visible.
  // Without this, leaflet renders with 0 height and overlaps the next card.
  useEffect(() => {
    if (!containerRef.current || !mapRef.current) return;
    const el = containerRef.current;
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(el);

    // Also observe visibility via IntersectionObserver (handles hidden -> visible)
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Delay to allow CSS transition to finish
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
          }
        });
      },
      { threshold: 0.1 },
    );
    io.observe(el);

    return () => {
      observer.disconnect();
      io.disconnect();
    };
  }, [ready, sites]);

  const hasRestricted = sites.some((s) => s.status === "Restricted");

  return (
    <div className="relative m-1 rounded-2xl overflow-hidden border border-border/60 bg-muted shadow-elegant ring-1 ring-border/60 isolate [&_.leaflet-pane]:!z-[1] [&_.leaflet-control]:!z-[2] [&_.leaflet-top]:!z-[2] [&_.leaflet-bottom]:!z-[2]">
      <div
        ref={containerRef}
        className="h-[clamp(320px,50dvh,520px)] w-full bg-muted relative z-0 [&_.leaflet-container]:!z-0 [&_.leaflet-container]:rounded-2xl"
      />
      {sites.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-muted/60 backdrop-blur-[1px] pointer-events-none">
          <span className="text-sm text-muted-foreground">
            No sites match the current filters.
          </span>
        </div>
      ) : (
        <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)] rounded-xl bg-card/95 backdrop-blur border border-border/60 px-3 py-2 shadow-lg">
          <div className="text-[10px] font-semibold text-foreground uppercase tracking-wide mb-1">
            Dive activity
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {diveRange.min.toLocaleString()}
              </span>
              <div className="flex gap-0.5">
                {BLUE_RAMP.map((c) => (
                  <div
                    key={c}
                    className="w-4 h-2.5 rounded-sm"
                    style={{ background: c }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {diveRange.max.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              · {sites.length} site{sites.length === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              ·{" "}
              <span
                className="inline-block size-2.5 bg-primary"
                style={{ borderRadius: "50% 50% 50% 0", transform: "rotate(-45deg)" }}
                aria-hidden
              />{" "}
              Dive site
            </span>
            {hasRestricted && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                ·{" "}
                <span
                  className="inline-block size-2.5 rounded-full border border-dashed border-red-500 bg-red-500/10"
                  aria-hidden
                />{" "}
                Restricted zone
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
