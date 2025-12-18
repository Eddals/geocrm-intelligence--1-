import React, { useEffect, useRef } from 'react';
import type { Lead } from '../types';
import { getLeadColor, getLeadFeatureId } from './LeadLayer';

declare const L: any;

type MapApi = { zoomIn: () => void; zoomOut: () => void; fitToData: () => void; flyTo: (lat: number, lng: number, zoom?: number) => void };

interface LeafletEngineProps {
  leads: Partial<Lead>[];
  selectedId?: string;
  onSelectLead?: (lead: Partial<Lead>, featureId: string) => void;
  onReady?: (api: MapApi) => void;
  showHeatmap?: boolean;
  showClusters?: boolean;
}

const DEFAULT_CENTER: [number, number] = [-23.5505, -46.6333];
const DEFAULT_ZOOM = 4;

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const hexToRgba = (hex: string, alpha: number) => {
  const normalized = String(hex || '').trim().replace('#', '');
  if (normalized.length !== 6) return `rgba(168,85,247,${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (![r, g, b].every(Number.isFinite)) return `rgba(168,85,247,${alpha})`;
  return `rgba(${r},${g},${b},${alpha})`;
};

const parseNumberLoose = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const formatBRL = (value: unknown) => {
  const n = parseNumberLoose(value);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
};

export default function LeafletEngine({ leads, selectedId, onSelectLead, onReady, showHeatmap = true, showClusters = true }: LeafletEngineProps) {
  const mapRef = useRef<any | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const clusterRef = useRef<any | null>(null);
  const plainRef = useRef<any | null>(null);
  const heatRef = useRef<any | null>(null);
  const heatBrokenRef = useRef<boolean>(false);
  const showHeatmapRef = useRef<boolean>(showHeatmap);
  const tileRef = useRef<any | null>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const markerMetaRef = useRef<Map<string, { color: string; glow: string }>>(new Map());
  const leadsRef = useRef<Partial<Lead>[]>(leads);
  const selectedIdRef = useRef<string | undefined>(selectedId);
  const prevSelectedIdRef = useRef<string | undefined>(selectedId);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const getMapSize = (map: any) => {
    try {
      const s = map?.getSize?.();
      const w = Number(s?.x);
      const h = Number(s?.y);
      return { w: Number.isFinite(w) ? w : 0, h: Number.isFinite(h) ? h : 0 };
    } catch {
      return { w: 0, h: 0 };
    }
  };

  const syncHeatLayerVisibility = () => {
    if (heatBrokenRef.current) return;
    const leaflet = (globalThis as any).L;
    const map = mapRef.current;
    const heat = heatRef.current;
    if (!leaflet || !map || !heat) return;
    const { w, h } = getMapSize(map);
    const sized = w > 0 && h > 0;
    try {
      if (!sized || !showHeatmapRef.current) {
        if (map.hasLayer?.(heat)) map.removeLayer?.(heat);
        return;
      }
      if (!map.hasLayer?.(heat)) map.addLayer?.(heat);
    } catch (err) {
      heatBrokenRef.current = true;
      try {
        if (map.hasLayer?.(heat)) map.removeLayer?.(heat);
      } catch {
        /* ignore */
      }
      heatRef.current = null;
      console.warn('Leaflet heat disabled due to error:', err);
    }
  };

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
  }, [showHeatmap]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    const leaflet = (globalThis as any).L;
    if (!leaflet) {
      console.error('Leaflet (window.L) not found. Check Leaflet script tag in index.html.');
      return;
    }

    const map = leaflet.map(container, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
    });

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);

    const tile = leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
      className: 'devtone-leaflet-tile',
      attribution: '© OpenStreetMap © CARTO'
    });
    tile.addTo(map);

    const hasCluster = typeof leaflet.markerClusterGroup === 'function';
    const cluster = hasCluster
      ? leaflet.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          removeOutsideVisibleBounds: true,
          maxClusterRadius: 56,
          iconCreateFunction: (c: any) => {
            const count = c.getChildCount?.() ?? 0;
            const size = count < 10 ? 42 : count < 50 ? 50 : 58;
            return leaflet.divIcon({
              className: 'lead-cluster-icon',
              html: `<div class="lead-cluster-bubble" style="--s:${size}px"><span>${count}</span></div>`,
              iconSize: [size, size]
            });
          }
        })
      : leaflet.layerGroup();

    const plain = leaflet.layerGroup();

    clusterRef.current = cluster;
    plainRef.current = plain;
    tileRef.current = tile;
    mapRef.current = map;

    const api: MapApi = {
      zoomIn: () => map.zoomIn(1),
      zoomOut: () => map.zoomOut(1),
      flyTo: (lat: number, lng: number, zoom = 13) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        try {
          map.flyTo([lat, lng], zoom, { animate: true, duration: 0.7 });
        } catch {
          map.setView([lat, lng], zoom);
        }
      },
      fitToData: () => {
        const pts: [number, number][] = [];
        leadsRef.current.forEach((l) => {
          const lat = Number(l.lat);
          const lng = Number(l.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
          pts.push([lat, lng]);
        });
        if (!pts.length) {
          map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
          return;
        }
        const bounds = leaflet.latLngBounds(pts);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
    };
    onReady?.(api);

    const ro = new ResizeObserver(() => {
      try {
        const rect = container.getBoundingClientRect();
        const sized = rect.width > 0 && rect.height > 0;
        if (!sized && heatRef.current && map.hasLayer?.(heatRef.current)) {
          map.removeLayer?.(heatRef.current);
        }
      } catch {
        /* ignore */
      }

      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }

      requestAnimationFrame(() => syncHeatLayerVisibility());
    });
    ro.observe(container);
    resizeObserverRef.current = ro;

    requestAnimationFrame(() => {
      try {
        map.invalidateSize();
      } catch {
        /* ignore */
      }
      syncHeatLayerVisibility();
    });

    return () => {
      try {
        ro.disconnect();
      } catch {
        /* ignore */
      }
      resizeObserverRef.current = null;
      try {
        map.remove();
      } catch {
        /* ignore */
      }
      mapRef.current = null;
      clusterRef.current = null;
      plainRef.current = null;
      heatRef.current = null;
      tileRef.current = null;
      markersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const leaflet = (globalThis as any).L;
    const map = mapRef.current;
    const cluster = clusterRef.current;
    const plain = plainRef.current;
    if (!leaflet || !map || !cluster || !plain) return;

    const targetLayer = showClusters ? cluster : plain;
    const otherLayer = showClusters ? plain : cluster;

    if (map.hasLayer(otherLayer)) map.removeLayer(otherLayer);
    if (!map.hasLayer(targetLayer)) map.addLayer(targetLayer);

    const heatSupported = typeof leaflet.heatLayer === 'function';
    const points = leads
      .map((l) => [Number(l.lat), Number(l.lng), 0.6] as [number, number, number])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));

    const { w: mapW, h: mapH } = getMapSize(map);
    const mapSized = mapW > 0 && mapH > 0;
    if (heatRef.current && map.hasLayer?.(heatRef.current) && !mapSized) {
      try {
        map.removeLayer?.(heatRef.current);
      } catch {
        /* ignore */
      }
    }

    if (heatSupported && !heatBrokenRef.current) {
      try {
        if (!heatRef.current) {
          heatRef.current = leaflet.heatLayer(points, {
            radius: 26,
            blur: 22,
            maxZoom: 12,
            gradient: {
              0.2: 'rgba(124,58,237,0)',
              0.45: 'rgba(124,58,237,0.60)',
              0.7: 'rgba(236,72,153,0.78)',
              1.0: 'rgba(56,189,248,0.92)'
            }
          });
        } else {
          heatRef.current.setLatLngs(points);
        }
      } catch (err) {
        heatBrokenRef.current = true;
        heatRef.current = null;
        console.warn('Leaflet heat disabled due to error:', err);
      }
    }

    if (heatRef.current) {
      try {
        if (showHeatmap && mapSized && !heatBrokenRef.current) {
          if (!map.hasLayer(heatRef.current)) map.addLayer(heatRef.current);
        } else if (map.hasLayer(heatRef.current)) {
          map.removeLayer(heatRef.current);
        }
      } catch (err) {
        heatBrokenRef.current = true;
        try {
          if (map.hasLayer(heatRef.current)) map.removeLayer(heatRef.current);
        } catch {
          /* ignore */
        }
        heatRef.current = null;
        console.warn('Leaflet heat disabled due to error:', err);
      }
    }

    targetLayer.clearLayers();
    markersRef.current.clear();
    markerMetaRef.current.clear();

    leads.forEach((lead, idx) => {
      const lat = Number(lead.lat);
      const lng = Number(lead.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      const featureId = getLeadFeatureId(lead, idx);
      const color = getLeadColor(lead);
      const glow = hexToRgba(color, 0.65);
      const selected = featureId === selectedIdRef.current;
      markerMetaRef.current.set(featureId, { color, glow });

      const icon = leaflet.divIcon({
        className: 'lead-marker-icon',
        html: `<div class="lead-marker${selected ? ' is-selected' : ''}" style="--c:${escapeHtml(color)};--glow:${escapeHtml(glow)}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const marker = leaflet.marker([lat, lng], {
        icon,
        riseOnHover: true,
        keyboard: false
      });

      const safeCompany = escapeHtml(lead.company || 'Lead');
      const safeStatus = escapeHtml((lead as any).status || '—');
      const safeCity = escapeHtml(lead.city || '');
      const safeAddress = escapeHtml(lead.address || '');
      const safePhone = escapeHtml((lead as any).phone || '');
      const safeEmail = escapeHtml((lead as any).email || '');
      const safeWebsite = escapeHtml((lead as any).website || '');
      const safeSource = escapeHtml((lead as any).source || '');
      const rating = Number((lead as any).rating);
      const safeRating = Number.isFinite(rating) ? `${rating.toFixed(1)} ★` : '';
      const safeValue = escapeHtml(formatBRL((lead as any).value));

      marker.bindPopup(
        `
          <div class="devtone-leaflet-popup">
            <div class="devtone-leaflet-popup__top">
              <div class="devtone-leaflet-popup__title">${safeCompany}</div>
              <div class="devtone-leaflet-popup__badge">${safeStatus}</div>
            </div>
            <div class="devtone-leaflet-popup__meta">
              ${safeValue ? `<div class="devtone-leaflet-popup__muted">Valor: ${safeValue}</div>` : ''}
              ${safeCity ? `<div>${safeCity}</div>` : ''}
              ${safeAddress ? `<div class="devtone-leaflet-popup__muted">${safeAddress}</div>` : ''}
              ${safeRating ? `<div class="devtone-leaflet-popup__muted">${safeRating}</div>` : ''}
              ${safeSource ? `<div class="devtone-leaflet-popup__muted">Fonte: ${safeSource}</div>` : ''}
              ${safePhone ? `<div class="devtone-leaflet-popup__muted">Tel: ${safePhone}</div>` : ''}
              ${safeEmail ? `<div class="devtone-leaflet-popup__muted">Email: ${safeEmail}</div>` : ''}
              ${safeWebsite ? `<div class="devtone-leaflet-popup__muted">Site: ${safeWebsite}</div>` : ''}
              <div class="devtone-leaflet-popup__muted">ID: ${escapeHtml(featureId)}</div>
            </div>
          </div>
        `,
        { closeButton: true, autoPanPadding: [24, 24] }
      );

      marker.on('click', () => onSelectLead?.(lead, featureId));
      targetLayer.addLayer(marker);
      markersRef.current.set(featureId, marker);
    });

    prevSelectedIdRef.current = selectedIdRef.current;
  }, [leads, onSelectLead, showClusters, showHeatmap]);

  useEffect(() => {
    const leaflet = (globalThis as any).L;
    if (!leaflet) return;
    const markers = markersRef.current;
    const meta = markerMetaRef.current;

    const updateMarker = (featureId: string, isSelected: boolean) => {
      const marker = markers.get(featureId);
      const info = meta.get(featureId);
      if (!marker || !info) return;
      const icon = leaflet.divIcon({
        className: 'lead-marker-icon',
        html: `<div class="lead-marker${isSelected ? ' is-selected' : ''}" style="--c:${escapeHtml(info.color)};--glow:${escapeHtml(info.glow)}"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });
      marker.setIcon(icon);
    };

    const prev = prevSelectedIdRef.current;
    if (prev && prev !== selectedId) updateMarker(prev, false);
    if (selectedId) updateMarker(selectedId, true);
    prevSelectedIdRef.current = selectedId;
  }, [selectedId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
