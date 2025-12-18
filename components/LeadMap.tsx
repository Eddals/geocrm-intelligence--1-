import React, { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

<<<<<<< ours
type SelectedLead = Partial<Lead>;
=======
type LeadStatus = 'Quente' | 'Morno' | 'Frio';

type SelectedLead = {
  company: string;
  city: string;
  state: string;
  status: LeadStatus;
  value: string;
};
>>>>>>> theirs

type Filters = {
  status: string;
  minValue: number;
  sector: string | null;
  location: string;
  state: string;
};

type DropdownId = keyof Filters;

type DropdownOption = {
  label: string;
  value: string;
};

const BR_UF = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

const formatThousands = (value: number) => value.toLocaleString('pt-BR');

const parseNumberLoose = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const formatBRL = (value: unknown) => {
  const n = parseNumberLoose(value);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
};

const extractUF = (text: string) => {
  const upper = String(text || '').toUpperCase();
  for (const uf of BR_UF) {
    if (new RegExp(`\\b${uf}\\b`).test(upper)) return uf;
  }
  return '';
};

const Icon = {
  Search: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Chevron: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  Plus: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Minus: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Layers: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M3 16l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  Home: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M3 10.5 12 3l9 7.5V21a1.5 1.5 0 0 1-1.5 1.5h-4.5v-7.5h-6v7.5H4.5A1.5 1.5 0 0 1 3 21V10.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Flame: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M12 22c4.418 0 8-3.134 8-7 0-2.57-1.43-4.1-3-5.5-1.4-1.246-2.5-2.4-2.5-4.5C14.5 3.343 13.6 2 12 1c.2 2.4-1.2 4-2.6 5.4C7.7 8.1 6 9.8 6 13c0 4.418 2.582 9 6 9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  ),
  List: (p: any) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
};

<<<<<<< ours
function ControlButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid place-items-center h-11 w-11 rounded-2xl border border-white/10 bg-white/[0.04] text-white/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur hover:bg-white/[0.07] transition"
    >
      {children}
    </button>
=======
function StatPill({ icon, label, value, tone = 'violet' }: { icon: React.ReactNode; label: string; value: string; tone?: 'red' | 'amber' | 'blue' | 'violet' }) {
  const toneMap = {
    red: 'text-red-300/90',
    amber: 'text-amber-300/90',
    blue: 'text-blue-300/90',
    violet: 'text-violet-300/90'
  }[tone];

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 grid place-items-center rounded-lg bg-white/[0.05] ${toneMap}`}>{icon}</div>
        <div className="text-sm text-white/80">{label}</div>
      </div>
      <div className="text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function SelectRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3">
      <div className="text-sm text-white/70">{label}</div>
      <div className="flex items-center gap-2 text-sm text-white/85">
        <span>{value}</span>
        <Icon.Chevron className="h-4 w-4 text-white/60" />
      </div>
    </div>
>>>>>>> theirs
  );
}

<<<<<<< ours
function TogglePill({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
<<<<<<< ours
=======
=======
function GlowButton({ children, onClick, variant = 'primary' }: { children: React.ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' }) {
>>>>>>> theirs
  if (variant === 'ghost') {
    return (
      <button
        onClick={onClick}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/[0.06] transition"
      >
        {children}
      </button>
    );
  }

>>>>>>> theirs
  return (
    <button
      onClick={onClick}
<<<<<<< ours
<<<<<<< ours
      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition ${
        active ? 'glass-purple text-white shadow-[0_16px_60px_-20px_rgba(168,85,247,0.9)]' : 'text-white/70 hover:bg-white/[0.08]'
      }`}
=======
      disabled={disabled}
      className={`relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white
      bg-gradient-to-b from-violet-500/90 to-violet-600/90
      shadow-[0_18px_60px_-18px_rgba(139,92,246,0.8)]
      hover:from-violet-500 hover:to-violet-700 transition disabled:opacity-60 disabled:hover:from-violet-500/90 disabled:hover:to-violet-600/90 ${className}`}
>>>>>>> theirs
=======
      className="relative inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white
      bg-gradient-to-b from-violet-500/90 to-violet-600/90
      shadow-[0_18px_60px_-18px_rgba(139,92,246,0.8)]
      hover:from-violet-500 hover:to-violet-700 transition"
>>>>>>> theirs
    >
      <span className="absolute inset-0 rounded-xl ring-1 ring-white/10" />
      <span className="absolute -inset-px rounded-xl opacity-60 blur-md bg-gradient-to-r from-violet-500/40 via-fuchsia-400/30 to-indigo-400/30" />
      <span className="relative">{children}</span>
    </button>
  );
}

<<<<<<< ours
function DropdownRow({
  id,
  label,
  value,
  open,
  options,
  onToggle,
  onSelect
}: {
  id: DropdownId;
  label: string;
  value: string;
  open: boolean;
  options: DropdownOption[];
  onToggle: (id: DropdownId) => void;
  onSelect: (id: DropdownId, value: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`w-full flex items-center justify-between gap-6 rounded-[28px] border px-6 py-5 backdrop-blur transition ${
          open
            ? 'border-violet-400/50 bg-white/[0.08]'
            : 'border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.03] hover:bg-white/[0.06]'
        }`}
      >
        <span className="text-lg font-medium text-white/55">{label}</span>
        <div className="flex items-center gap-3 text-white">
          <span className="text-lg font-semibold text-white/90">{value}</span>
          <Icon.Chevron className={`h-5 w-5 text-white/55 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open ? (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b1f]/95 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.65)]">
          {options.map((opt) => (
            <button
              type="button"
              key={`${id}-${opt.value}`}
              onClick={() => onSelect(id, opt.value)}
              className="w-full text-left px-4 py-3 text-sm text-white/85 hover:bg-white/[0.08] transition"
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface LeadMapProps {
  leads: Lead[];
  discoveryResults?: Partial<Lead>[];
  addLead?: (lead: Partial<Lead>) => void;
  notify?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

<<<<<<< ours
export default function LeadMap({ leads, discoveryResults = [], addLead }: LeadMapProps) {
  const [selected, setSelected] = useState<SelectedLead | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>(undefined);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const mapApiRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fitToData: () => void } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: 'Todos',
    minValue: 5000,
    sector: null,
    location: 'Brasil',
    state: 'SP'
  });

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (!panelRef.current?.contains(target)) setOpenDropdown(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const allLeads = useMemo(
    () => [...(leads || []), ...(discoveryResults || [])].filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)),
    [leads, discoveryResults]
  );
=======
export default function LeadMap({ leads, discoveryResults = [], addLead, notify }: LeadMapProps) {
=======
export default function DevtoneMapDashboard() {
>>>>>>> theirs
  const [selected, setSelected] = useState<SelectedLead>({
    company: 'TechCorp Solutions',
    city: 'São Paulo',
    state: 'SP',
    status: 'Quente',
    value: 'R$ 15.000'
  });

<<<<<<< ours
  const allLeads = useMemo(() => [...(leads || []), ...(discoveryResults || [])].filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)), [leads, discoveryResults]);
>>>>>>> theirs

  const sectorOptions = useMemo(() => {
    const tags = new Set<string>();
    allLeads.forEach((lead) => {
      (lead.tags || []).forEach((tag) => {
        const t = String(tag || '').trim();
        if (!t) return;
        tags.add(t);
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allLeads]);

  const statusOptions = useMemo(() => {
    const values = ['Todos', 'Quente', 'Morno', 'Frio', ...Object.values(PipelineStage)];
    return Array.from(new Set(values)).map((v) => ({ label: v, value: v }));
  }, []);

  const minValueOptions = useMemo<DropdownOption[]>(
    () => [0, 5000, 10000, 20000, 50000, 100000].map((n) => ({ value: String(n), label: formatThousands(n) })),
    []
  );

  const locationOptions = useMemo<DropdownOption[]>(() => [{ value: 'Brasil', label: 'Brasil' }, { value: 'USA', label: 'USA' }], []);

  const ufOptions = useMemo<DropdownOption[]>(() => {
    const values = ['Todos', ...BR_UF];
    return values.map((uf) => ({ value: uf, label: uf }));
  }, []);

  const sectorDropdownOptions = useMemo<DropdownOption[]>(() => {
    const opts = [{ value: '', label: 'Selecionar' }, ...sectorOptions.map((t) => ({ value: t, label: t }))];
    return opts;
  }, [sectorOptions]);

  const visibleLeads = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const status = filters.status;
    const minValue = Number.isFinite(filters.minValue) ? filters.minValue : 0;
    const sector = filters.sector;
    const uf = filters.state;

    return allLeads.filter((lead) => {
      if (q) {
        const hay = `${lead.company || ''} ${lead.city || ''} ${lead.address || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }

      if (status && status !== 'Todos') {
        if (String(lead.status || '') !== status) return false;
      }

      if (minValue > 0) {
        const v = parseNumberLoose((lead as any).value);
        if (!Number.isFinite(v) || v < minValue) return false;
      }

      if (sector) {
        const tags = (lead.tags || []).map((t) => String(t || '').toLowerCase());
        if (!tags.includes(sector.toLowerCase())) return false;
      }

      if (uf && uf !== 'Todos') {
        const hay = `${lead.city || ''} ${lead.address || ''}`.toUpperCase();
        if (!new RegExp(`\\b${uf}\\b`).test(hay)) return false;
      }

      return true;
    });
  }, [allLeads, filters.minValue, filters.sector, filters.state, filters.status, searchTerm]);

  useEffect(() => {
<<<<<<< ours
    if (!visibleLeads.length) {
      setSelected(null);
      setSelectedFeatureId(undefined);
      return;
    }

    const selectedStillExists =
      !!selectedFeatureId && visibleLeads.some((lead, idx) => getLeadFeatureId(lead, idx) === selectedFeatureId);

    if (!selectedStillExists) {
      const first = visibleLeads[0];
      setSelected(first);
      setSelectedFeatureId(getLeadFeatureId(first, 0));
      return;
    }

    const match = visibleLeads.find((lead, idx) => getLeadFeatureId(lead, idx) === selectedFeatureId);
    if (match) setSelected(match);
  }, [selectedFeatureId, visibleLeads]);

  const totals = useMemo(
    () => ({
      leads: visibleLeads.length.toString(),
      clusters: Math.max(1, Math.round(visibleLeads.length / 12)).toString()
    }),
<<<<<<< ours
    [visibleLeads]
=======
    [allLeads]
>>>>>>> theirs
  );

  const selectedDisplay = useMemo(() => {
    if (!selected) return null;
    const company = selected.company || 'Lead';
    const city = selected.city || '';
    const uf = extractUF(`${selected.address || ''} ${selected.city || ''}`) || filters.state;
    const status = String((selected as any).status || '—');
    const value = formatBRL((selected as any).value);
    return { company, city, uf, status, value };
  }, [filters.state, selected]);

  const canAddSelected = useMemo(() => {
    if (!addLead || !selected) return false;
    if (selected.id) return !leads.some((l) => l.id === selected.id);
    return true;
  }, [addLead, leads, selected]);
=======
    if (!allLeads.length) return;
    const first = allLeads[0];
    setSelected({
      company: first.company || 'Lead',
      city: first.city,
      state: '',
      status: (first.status as LeadStatus) || 'Quente',
      value: first.value ? first.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) : '—'
    });
  }, [allLeads]);

  const totals = useMemo(() => ({ leads: allLeads.length.toString(), clusters: Math.max(1, Math.round(allLeads.length / 12)).toString(), mode: 'Detecção Avançada' }), [allLeads]);
=======
  const totals = useMemo(() => ({ leads: '1.250', clusters: '25', mode: 'Detecção Avançada' }), []);
>>>>>>> theirs
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    let map: maplibregl.Map | null = null;
    try {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: '/map/devtone-style.json',
        center: [-46.6333, -23.5505],
        zoom: 3.5,
        attributionControl: false,
        pitch: 0
      });
    } catch {
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              maxzoom: 19
            }
          },
          layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#0b0b1f' } },
            { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.9 } }
          ]
        } as any,
        center: [-46.6333, -23.5505],
        zoom: 3.5,
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
    const ro = new ResizeObserver(resize);
    ro.observe(mapContainerRef.current);
    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      ro.disconnect();
      map?.remove();
      mapRef.current = null;
    };
<<<<<<< ours
  }, [allLeads]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const geojson = {
      type: 'FeatureCollection',
      features: allLeads.map((l, idx) => ({
        type: 'Feature',
        properties: { id: l.id || `lead-${idx}`, company: l.company || 'Lead', status: l.status || 'Morno' },
        geometry: { type: 'Point', coordinates: [Number(l.lng), Number(l.lat)] }
      }))
    } as any;

    const sourceId = 'leads-source';
    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: geojson, cluster: true, clusterRadius: 50 });

      map.addLayer({
        id: 'lead-clusters',
        type: 'circle',
        source: sourceId,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#7c3aed',
          'circle-radius': ['step', ['get', 'point_count'], 16, 20, 22, 50, 28],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff'
        }
      });

      map.addLayer({
        id: 'lead-cluster-count',
        type: 'symbol',
        source: sourceId,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-size': 12
        },
        paint: {
          'text-color': '#fff'
        }
      });

      map.addLayer({
        id: 'lead-points',
        type: 'circle',
        source: sourceId,
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match',
            ['get', 'status'],
            'Quente',
            '#f97316',
            'Frio',
            '#3b82f6',
            '#eab308'
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
          'circle-opacity': 0.95
        }
      });

      map.on('click', 'lead-points', (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const id = feature.properties?.id;
        const lead = allLeads.find((l) => (l.id || `lead-${allLeads.indexOf(l)}`) === id);
        if (!lead) return;
        setSelected({
          company: lead.company || 'Lead',
          city: lead.city,
          state: '',
          status: (lead.status as LeadStatus) || 'Morno',
          value: lead.value ? lead.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 }) : '—'
        });
        if (lead.lat && lead.lng) {
          map.flyTo({ center: [Number(lead.lng), Number(lead.lat)], zoom: 10, speed: 0.7 });
        }
      });
    }
  }, [allLeads]);
>>>>>>> theirs

  const handleAddSelected = () => {
    const match = allLeads.find((l) => (l.company || '').toLowerCase() === (selected.company || '').toLowerCase());
    if (match && addLead) {
      addLead(match);
      notify?.('Lead adicionado ao CRM', 'success');
    }
  };
=======
  }, []);
>>>>>>> theirs

  const handleToggleDropdown = (id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const handleSelectDropdown = (id: DropdownId, value: string) => {
    setOpenDropdown(null);

    if (id === 'minValue') {
      const n = Number(value);
      setFilters((prev) => ({ ...prev, minValue: Number.isFinite(n) ? n : prev.minValue }));
      return;
    }

    if (id === 'sector') {
      const v = String(value || '').trim();
      setFilters((prev) => ({ ...prev, sector: v ? v : null }));
      return;
    }

    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  return (
    <div className="min-h-screen w-full bg-[#070714] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
<<<<<<< ours
        <div className="absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="absolute -bottom-48 left-10 h-[460px] w-[560px] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute top-24 -right-24 h-[520px] w-[520px] rounded-full bg-fuchsia-500/12 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl gap-8 px-6 py-10">
        <aside
          ref={panelRef}
          className="w-[360px] shrink-0 rounded-[36px] border border-white/10 bg-[#0b0b1f]/80 p-7 shadow-[0_45px_110px_rgba(0,0,0,0.55)] backdrop-blur-xl"
        >
          <div className="mb-6">
            <div className="text-xs uppercase tracking-[0.28em] text-violet-200/80 mb-2">Devtone Leads</div>
            <div className="text-2xl font-extrabold text-white">Mapa Inteligente</div>
          </div>

          <div className="relative mb-6">
            <Icon.Search className="pointer-events-none absolute left-6 top-1/2 h-6 w-6 -translate-y-1/2 text-white/45" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-[28px] border border-white/10 bg-white/[0.06] px-14 py-5 text-lg text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/50"
              placeholder="Buscar empresa/cidade..."
            />
          </div>

          <div className="space-y-4">
            <DropdownRow
              id="status"
              label="Status"
              value={filters.status || 'Todos'}
              open={openDropdown === 'status'}
              options={statusOptions}
              onToggle={handleToggleDropdown}
              onSelect={handleSelectDropdown}
            />

            <DropdownRow
              id="minValue"
              label="Min Valor"
              value={formatThousands(filters.minValue)}
              open={openDropdown === 'minValue'}
              options={minValueOptions}
              onToggle={handleToggleDropdown}
              onSelect={handleSelectDropdown}
            />

            <DropdownRow
              id="sector"
              label="Setor"
              value={filters.sector || 'Selecionar'}
              open={openDropdown === 'sector'}
              options={sectorDropdownOptions}
              onToggle={handleToggleDropdown}
              onSelect={handleSelectDropdown}
            />

            <DropdownRow
              id="location"
              label="Localização"
              value={filters.location || 'Brasil'}
              open={openDropdown === 'location'}
              options={locationOptions}
              onToggle={handleToggleDropdown}
              onSelect={handleSelectDropdown}
            />

            <DropdownRow
              id="state"
              label="Estado"
              value={filters.state || 'SP'}
              open={openDropdown === 'state'}
              options={ufOptions}
              onToggle={handleToggleDropdown}
              onSelect={handleSelectDropdown}
            />
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0b1f]/70 px-5 py-4 backdrop-blur">
            <div className="text-sm text-white/70">
              Leads no mapa: <span className="font-extrabold text-white">{totals.leads}</span>
              <span className="mx-3 h-4 w-px bg-white/10 inline-block align-middle" />
              Clusters: <span className="font-extrabold text-white">{totals.clusters}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="inline-flex h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_0_4px_rgba(168,85,247,0.18)]" />
              Neon Purple • Glass UI
            </div>
          </div>

          <div className="relative h-[680px] overflow-hidden rounded-[38px] border border-white/10 bg-[#0b0b1f]/40 shadow-[0_60px_160px_rgba(109,40,217,0.18)]">
            <div className="absolute inset-0">
              <MapEngine
                leads={visibleLeads}
                selectedId={selectedFeatureId}
                onSelectLead={(lead, featureId) => {
                  setSelected(lead);
                  setSelectedFeatureId(featureId);
                }}
                onReady={(api) => {
                  mapApiRef.current = api;
                }}
                showHeatmap={showHeatmap}
                showClusters={showClusters}
              />
            </div>

            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(139,92,246,0.30),transparent_42%),radial-gradient(circle_at_82%_12%,rgba(236,72,153,0.18),transparent_46%),radial-gradient(circle_at_50%_88%,rgba(56,189,248,0.14),transparent_45%)] mix-blend-screen" />
            <div className="pointer-events-none absolute inset-0 ring-1 ring-violet-400/25" />

            <div className="absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-3">
              <ControlButton onClick={() => mapApiRef.current?.zoomIn()}>
                <Icon.Plus className="h-5 w-5" />
              </ControlButton>
              <ControlButton onClick={() => mapApiRef.current?.zoomOut()}>
                <Icon.Minus className="h-5 w-5" />
              </ControlButton>
              <ControlButton onClick={() => mapApiRef.current?.fitToData()}>
                <Icon.Layers className="h-5 w-5" />
              </ControlButton>
              <ControlButton onClick={() => setShowHeatmap(true)}>
                <Icon.Flame className="h-5 w-5" />
              </ControlButton>
              <ControlButton onClick={() => setShowClusters(true)}>
                <Icon.Home className="h-5 w-5" />
              </ControlButton>
=======
        <div className="absolute -top-40 left-1/2 h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="absolute -bottom-48 left-10 h-[460px] w-[560px] rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="absolute top-24 -right-24 h-[520px] w-[520px] rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto flex max-w-6xl gap-6 px-6 py-8">
        <aside className="w-[320px] rounded-2xl border border-white/10 bg-[#0b0b1f]/95 p-5 shadow-[0_30px_60px_rgba(0,0,0,0.6)] backdrop-blur">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 text-white grid place-items-center shadow-lg">
              <Icon.Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-violet-200">Devtone Leads</p>
              <p className="text-lg font-bold text-white">Mapa Inteligente</p>
            </div>
          </div>

          <div className="relative mb-4">
            <Icon.Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
            <input
              className="w-full rounded-xl border border-white/10 bg-white/[0.06] px-10 py-2 text-sm text-white placeholder:text-white/60 focus:border-violet-500 focus:outline-none"
              placeholder="Buscar empresa/cidade..."
            />
          </div>

          <div className="space-y-2">
            <SelectRow label="Status" value="Todos" />
            <SelectRow label="Min Valor" value="5.000" />
            <SelectRow label="Setor" value="Selecionar" />
            <SelectRow label="Localização" value="Brasil" />
            <SelectRow label="Estado" value="SP" />
          </div>

          <GlowButton onClick={() => {}}>{'Buscar Leads'}</GlowButton>

          <div className="mt-4 space-y-2">
            <StatPill icon={<Icon.Flame className="h-4 w-4" />} label="Quentes" value="340" tone="red" />
            <StatPill icon={<Icon.Flame className="h-4 w-4 rotate-45" />} label="Mornos" value="510" tone="amber" />
            <StatPill icon={<Icon.Flame className="h-4 w-4 rotate-90" />} label="Frios" value="400" tone="blue" />
          </div>
        </aside>

        <main className="flex-1">
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-white/10 bg-[#0b0b1f]/80 px-4 py-3 backdrop-blur">
            <div className="flex items-center gap-2 text-sm text-white/80">
              <Icon.Home className="h-4 w-4 text-violet-300" />
              Leads Totais: <span className="font-bold text-white">{totals.leads}</span>
              <span className="mx-3 h-4 w-px bg-white/15" />
              <Icon.Cluster className="h-4 w-4 text-violet-300" />
              Clusters: <span className="font-bold text-white">{totals.clusters}</span>
              <span className="mx-3 h-4 w-px bg-white/15" />
              Modo: <span className="font-semibold text-white">{totals.mode}</span>
>>>>>>> theirs
            </div>
            <div className="flex items-center gap-2 text-xs text-white/70">
              <Icon.List className="h-4 w-4" /> Ver Lista
            </div>
          </div>

<<<<<<< ours
            <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/10 bg-[#0b0b1f]/70 px-3 py-2 backdrop-blur">
              <TogglePill active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)}>
                <Icon.Flame className="h-4 w-4 text-amber-300" /> Heatmap
              </TogglePill>
              <TogglePill active={showClusters} onClick={() => setShowClusters((v) => !v)}>
                <Icon.Layers className="h-4 w-4 text-violet-300" /> Clusters
              </TogglePill>
              <TogglePill active={false}>
                <Icon.List className="h-4 w-4 text-white/70" /> Ver Lista
              </TogglePill>
            </div>

            <div className="absolute bottom-6 right-6 w-[320px] rounded-[26px] border border-white/10 bg-[#0b0b1f]/75 p-5 shadow-[0_35px_100px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2 text-violet-200/90 text-xs uppercase tracking-[0.22em]">
                <Icon.Layers className="h-4 w-4" /> Lead Selecionado
              </div>
              <p className="text-xl font-extrabold text-white leading-tight">{selectedDisplay?.company || '—'}</p>
              <p className="mt-1 text-white/60">
                {selectedDisplay?.city || '—'}
                {selectedDisplay?.uf ? `, ${selectedDisplay.uf}` : ''}
              </p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-white/60">Status</span>
                <span className="rounded-full bg-violet-500/20 px-2.5 py-1 text-xs font-extrabold text-violet-100 border border-violet-400/25">
                  {selectedDisplay?.status || '—'}
                </span>
=======
          <div className="relative h-[560px] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b0b1f] via-[#0f0f2a] to-[#0b0b1f] shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
            <div ref={mapContainerRef} className="absolute inset-0" />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-white/[0.08] px-4 py-2 text-sm backdrop-blur">
              <button className="flex items-center gap-2 rounded-full bg-white/[0.14] px-3 py-1.5 text-white">
                <Icon.Flame className="h-4 w-4 text-amber-300" /> Heatmap
              </button>
              <button className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white/80 hover:bg-white/[0.1]">
                <Icon.Cluster className="h-4 w-4 text-violet-300" /> Clusters
              </button>
              <button className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white/80 hover:bg-white/[0.1]">
                <Icon.List className="h-4 w-4 text-white/70" /> Ver Lista
              </button>
            </div>
            <div className="absolute right-4 top-4 flex flex-col gap-2">
              <GlowButton variant="ghost">
                <Icon.Plus className="h-4 w-4" />
              </GlowButton>
              <GlowButton variant="ghost">
                <Icon.Minus className="h-4 w-4" />
              </GlowButton>
              <GlowButton variant="ghost">
                <Icon.Layers className="h-4 w-4" />
              </GlowButton>
            </div>

            <div className="absolute bottom-4 right-4 w-64 rounded-2xl border border-white/10 bg-[#0b0b1f]/90 p-4 text-sm backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-violet-200 text-xs uppercase tracking-wide">
                <Icon.Layers className="h-4 w-4" /> Lead Selecionado
>>>>>>> theirs
              </div>
              <p className="text-lg font-bold text-white leading-tight">{selected.company}</p>
              <p className="text-white/70">
                {selected.city}, {selected.state}
              </p>
              <div className="mt-2 flex items-center justify-between">
<<<<<<< ours
                <span className="text-white/60">Valor</span>
                <span className="font-extrabold text-emerald-300">{selectedDisplay?.value || '—'}</span>
              </div>
              {canAddSelected ? (
                <button type="button" onClick={handleAddSelected} className="glass-purple w-full mt-5 px-5 py-3 rounded-2xl font-bold">
                  Adicionar ao CRM
                </button>
              ) : null}
            </div>

            <div className="pointer-events-none absolute bottom-2 left-4 text-xs text-white/45">
              * Mapa integrado com OpenStreetMap e cluster de leads. Clique nos marcadores para ver detalhes.
            </div>
=======
                <span className="text-white/70">Status</span>
                <span className="rounded-full bg-amber-500/20 px-2 py-1 text-xs font-semibold text-amber-200">{selected.status}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/70">Valor</span>
                <span className="font-extrabold text-emerald-300">{selected.value}</span>
              </div>
              <GlowButton onClick={() => setSelected({ ...selected })} className="mt-3">
                Adicionar ao CRM
              </GlowButton>
            </div>
>>>>>>> theirs
          </div>
        </main>
      </div>
    </div>
  );
}
