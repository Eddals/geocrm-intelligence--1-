import React, { useEffect, useRef } from 'react';
import maplibregl, { Map as MapLibreMap, Popup as MapLibrePopup } from 'maplibre-gl';
import type { Lead } from '../types';
import { leadsToFeatureCollection } from './LeadLayer';
import 'maplibre-gl/dist/maplibre-gl.css';

const styleUrl = new URL('./devtone-style.json', import.meta.url).toString();

interface MapEngineProps {
  leads: Partial<Lead>[];
  selectedId?: string;
  onSelectLead?: (lead: Partial<Lead>) => void;
  onReady?: (api: { zoomIn: () => void; zoomOut: () => void; fitToData: () => void }) => void;
  showHeatmap?: boolean;
  showClusters?: boolean;
}

const MapEngine: React.FC<MapEngineProps> = ({ leads, selectedId, onSelectLead, onReady, showHeatmap = true, showClusters = true }) => {
  const mapRef = useRef<MapLibreMap | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<MapLibrePopup | null>(null);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    let map: MapLibreMap | null = null;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: styleUrl,
        center: [-46.6333, -23.5505],
        zoom: 4,
        attributionControl: false
      });
    } catch (err) {
      console.error('Map init error, falling back to demo style', err);
      map = new maplibregl.Map({
        container: containerRef.current,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [-46.6333, -23.5505],
        zoom: 4,
        attributionControl: false
      });
    }

    mapRef.current = map;

    const resize = () => {
      try {
        map?.resize();
      } catch {
        /* ignore */
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(containerRef.current);
    window.addEventListener('resize', resize);

    map.on('load', () => {
      const features = leadsToFeatureCollection(leads);
      map.addSource('leads', {
        type: 'geojson',
        data: features,
        cluster: true,
        clusterRadius: 50,
        clusterMaxZoom: 14
      });

      map.addLayer({
        id: 'leads-heat',
        type: 'heatmap',
        source: 'leads',
        maxzoom: 12,
        paint: {
          'heatmap-weight': 0.6,
          'heatmap-intensity': 0.8,
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(124,58,237,0)',
            0.4,
            'rgba(124,58,237,0.5)',
            0.7,
            'rgba(59,130,246,0.7)',
            1,
            'rgba(16,185,129,0.9)'
          ],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 12, 32],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0]
        }
      });

      map.addLayer({
        id: 'lead-clusters-glow',
        type: 'circle',
        source: 'leads',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#a855f7',
          'circle-opacity': 0.32,
          'circle-blur': 0.85,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            28,
            10,
            34,
            25,
            44
          ]
        }
      });

      map.addLayer({
        id: 'lead-clusters',
        type: 'circle',
        source: 'leads',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#8b5cf6',
          'circle-opacity': 0.92,
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            18,
            10,
            22,
            25,
            28
          ],
          'circle-stroke-color': 'rgba(233,213,255,0.95)',
          'circle-stroke-width': 2.5
        }
      });

      map.addLayer({
        id: 'lead-cluster-count',
        type: 'symbol',
        source: 'leads',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
          'text-size': 12
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(15,23,42,0.8)',
          'text-halo-width': 1.2
        }
      });

      map.addLayer({
        id: 'lead-points-glow',
        type: 'circle',
        source: 'leads',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 10, 14, 18],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.24,
          'circle-blur': 0.8
        }
      });

      map.addLayer({
        id: 'lead-points',
        type: 'circle',
        source: 'leads',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 14, 12],
          'circle-color': ['get', 'color'],
<<<<<<< ours
          'circle-stroke-color': 'rgba(255,255,255,0.9)',
          'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedIdRef.current || ''], 3, 1.5],
=======
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': ['case', ['==', ['get', 'id'], selectedId || ''], 3, 1.5],
>>>>>>> theirs
          'circle-opacity': 0.95
        }
      });

      const fitToData = () => {
        const fc = leadsToFeatureCollection(leads);
        if (!fc.features.length) return;
        const bounds = new maplibregl.LngLatBounds();
        fc.features.forEach((f) => bounds.extend(f.geometry.coordinates as [number, number]));
        map.fitBounds(bounds, { padding: 60, maxZoom: 14, duration: 0 });
      };

      const zoomIn = () => map.zoomIn({ duration: 200 });
      const zoomOut = () => map.zoomOut({ duration: 200 });

      onReady?.({ zoomIn, zoomOut, fitToData });
      fitToData();

<<<<<<< ours
      const setVis = (layer: string, visible: boolean) => {
        if (map.getLayer(layer)) {
          map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
        }
      };
      setVis('leads-heat', showHeatmapRef.current);
      setVis('lead-clusters-glow', showClustersRef.current);
      setVis('lead-clusters', showClustersRef.current);
      setVis('lead-cluster-count', showClustersRef.current);

=======
>>>>>>> theirs
      map.on('click', 'lead-clusters', (e) => {
        const featuresCluster = map.queryRenderedFeatures(e.point, { layers: ['lead-clusters'] });
        const clusterId = featuresCluster[0]?.properties?.cluster_id;
        if (clusterId === undefined) return;
        const source = map.getSource('leads') as maplibregl.GeoJSONSource & { getClusterExpansionZoom: any };
        source.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({ center: (featuresCluster[0].geometry as any).coordinates, zoom, duration: 300 });
        });
      });

      map.on('click', 'lead-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const { id, company, name, status } = feature.properties as any;
        const [lng, lat] = feature.geometry.type === 'Point' ? feature.geometry.coordinates : [0, 0];
        const lead = leads.find((l) => (l.id || '') === id) || {};
        onSelectLead?.(lead);

        popupRef.current?.remove();
        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat([lng, lat])
          .setHTML(`
            <div style="min-width:220px;font-family:Inter,sans-serif;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <h3 style="margin:0;font-weight:800;color:#0f172a;font-size:14px;line-height:1.2;">${company || 'Lead'}</h3>
                <span style="font-size:10px;padding:4px 6px;border-radius:8px;background:#ede9fe;color:#5b21b6;font-weight:700;">${status || 'Lead'}</span>
              </div>
              ${name ? `<p style="margin:0 0 6px 0;color:#475569;font-size:12px;">Contato: ${name}</p>` : ''}
              <p style="margin:0;color:#94a3b8;font-size:11px;">ID: ${id}</p>
            </div>
          `)
          .addTo(map);
        popupRef.current = popup;
      });

      map.on('mouseenter', 'lead-points', () => (map.getCanvas().style.cursor = 'pointer'));
      map.on('mouseleave', 'lead-points', () => (map.getCanvas().style.cursor = ''));
    });

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('leads') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      source.setData(leadsToFeatureCollection(leads));
    }

    if (map.getLayer('lead-points')) {
      if (selectedId) {
        map.setPaintProperty('lead-points', 'circle-stroke-width', ['case', ['==', ['get', 'id'], selectedId], 3, 1.5]);
      } else {
        map.setPaintProperty('lead-points', 'circle-stroke-width', 1.5);
      }
    }
  }, [leads, selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const setVis = (layer: string, visible: boolean) => {
      if (map.getLayer(layer)) {
        map.setLayoutProperty(layer, 'visibility', visible ? 'visible' : 'none');
      }
    };
    setVis('leads-heat', showHeatmap);
    setVis('lead-clusters-glow', showClusters);
    setVis('lead-clusters', showClusters);
    setVis('lead-cluster-count', showClusters);
  }, [showHeatmap, showClusters]);

  return <div ref={containerRef} className="w-full h-full" />;
};

export default MapEngine;
