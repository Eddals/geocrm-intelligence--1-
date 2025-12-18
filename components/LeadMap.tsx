import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Lead, PipelineStage } from '../types';
import LeafletEngine from '../map/LeafletEngine';
import { getLeadColor, getLeadFeatureId } from '../map/LeadLayer';
import {
  Briefcase,
  Building,
  CheckCircle,
  ChevronDown,
  Clock,
  DollarSign,
  Factory,
  Flame,
  Globe,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Layers,
  List,
  Loader2,
  MapPin,
  Minus,
  Phone,
  Plus,
  Scale,
  Search,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Tag,
  Truck,
  UtensilsCrossed,
  XCircle
} from 'lucide-react';
import { discoverLeadsWithOpenAI } from '../services/openaiService';
import { discoverLeadsWithPerplexity } from '../services/perplexityService';

type SelectedLead = Partial<Lead>;

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
  icon?: React.ReactNode;
  imgSrc?: string;
};

const BR_UF = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] as const;

const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY'
] as const;

const INDUSTRIES = [
  'Tecnologia e Software',
  'Saúde e Medicina',
  'Imobiliário',
  'Restaurantes e Alimentação',
  'Varejo e E-commerce',
  'Construção e Engenharia',
  'Serviços Financeiros',
  'Serviços Jurídicos',
  'Marketing e Publicidade',
  'Educação',
  'Indústria e Manufatura',
  'Logística e Transporte',
  'Turismo e Hotelaria'
] as const;

const LOCATION_OPTIONS = [
  { value: 'Brasil', label: 'Brasil', imgSrc: 'https://flagcdn.com/w40/br.png' },
  { value: 'USA', label: 'USA', imgSrc: 'https://flagcdn.com/w40/us.png' }
] as const;

const INDUSTRY_ICONS: Record<string, React.ReactNode> = {
  'Tecnologia e Software': <Briefcase className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Saúde e Medicina': <HeartPulse className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  Imobiliário: <Building className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Restaurantes e Alimentação': <UtensilsCrossed className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Varejo e E-commerce': <ShoppingBag className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Construção e Engenharia': <Hammer className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Serviços Financeiros': <DollarSign className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Serviços Jurídicos': <Scale className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Marketing e Publicidade': <Sparkles className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  Educação: <GraduationCap className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Indústria e Manufatura': <Factory className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Logística e Transporte': <Truck className="w-4 h-4 text-gray-400 dark:text-slate-300" />,
  'Turismo e Hotelaria': <MapPin className="w-4 h-4 text-gray-400 dark:text-slate-300" />
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  Quente: <Flame className="w-4 h-4 text-orange-500" />,
  Morno: <Sparkles className="w-4 h-4 text-amber-500" />,
  Frio: <Snowflake className="w-4 h-4 text-sky-500" />,
  [PipelineStage.NEW]: <Sparkles className="w-4 h-4 text-indigo-500" />,
  [PipelineStage.ANALYSIS]: <Search className="w-4 h-4 text-violet-500" />,
  [PipelineStage.CONTACT]: <Phone className="w-4 h-4 text-amber-500" />,
  [PipelineStage.WAITING]: <Clock className="w-4 h-4 text-yellow-500" />,
  [PipelineStage.QUALIFIED]: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  [PipelineStage.CLOSED]: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  [PipelineStage.LOST]: <XCircle className="w-4 h-4 text-rose-500" />
};

const formatThousands = (value: number) => value.toLocaleString('pt-BR');

const parseNumberLoose = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return NaN;
  const cleaned = value.replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const formatMoney = (value: unknown, location: string) => {
  const n = parseNumberLoose(value);
  if (!Number.isFinite(n)) return '—';
  const isUSA = String(location || '').toUpperCase() === 'USA';
  return n.toLocaleString('pt-BR', {
    style: 'currency',
    currency: isUSA ? 'USD' : 'BRL',
    minimumFractionDigits: 0
  });
};

const extractRegionCode = (text: string, codes: readonly string[]) => {
  const upper = String(text || '').toUpperCase();
  for (const code of codes) {
    if (new RegExp(`\\b${code}\\b`).test(upper)) return code;
  }
  return '';
};

function ControlButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid place-items-center h-9 w-9 rounded-xl border border-gray-200/70 dark:border-white/10 bg-white/90 dark:bg-white/[0.05] text-gray-700 dark:text-white/90 shadow-sm backdrop-blur hover:bg-gray-50 dark:hover:bg-white/[0.08] transition"
    >
      {children}
    </button>
  );
}

function TogglePill({
  active,
  onClick,
  children,
  simpleActive = false
}: {
  active: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  simpleActive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-150 ${
        active
          ? simpleActive
            ? 'bg-indigo-600 text-white shadow-sm dark:bg-violet-600/80'
            : 'glass-purple text-white shadow-[0_16px_50px_-24px_rgba(168,85,247,0.9)]'
          : 'text-gray-600 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/[0.08]'
      }`}
    >
      {children}
    </button>
  );
}

function DropdownRow({
  id,
  label,
  value,
  selectedValue,
  icon,
  open,
  options,
  onToggle,
  onSelect
}: {
  id: DropdownId;
  label: string;
  value: string;
  selectedValue?: string;
  icon?: React.ReactNode;
  open: boolean;
  options: DropdownOption[];
  onToggle: (id: DropdownId) => void;
  onSelect: (id: DropdownId, value: string) => void;
}) {
  const selectedOption = useMemo(() => {
    if (selectedValue === undefined) return null;
    return options.find((opt) => opt.value === selectedValue) || null;
  }, [options, selectedValue]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full px-3 py-3 rounded-xl border transition-all flex items-center justify-between text-sm ${
          open
            ? 'border-indigo-300 bg-indigo-50 dark:border-violet-400/50 dark:bg-white/[0.08]'
            : 'border-gray-200 bg-white dark:border-white/10 dark:bg-slate-900/70 hover:bg-gray-50 dark:hover:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {icon ? <span className="text-gray-400 dark:text-slate-400">{icon}</span> : null}
          <span className="text-gray-500 dark:text-slate-400 truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          {selectedOption?.imgSrc ? (
            <img src={selectedOption.imgSrc} alt={selectedOption.label} className="w-5 h-auto rounded-sm shadow-sm flex-shrink-0" />
          ) : selectedOption?.icon ? (
            <span className="flex-shrink-0">{selectedOption.icon}</span>
          ) : null}
          <span className="font-semibold text-gray-900 dark:text-slate-100 truncate">{value}</span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open ? (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 shadow-lg max-h-60 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              type="button"
              key={`${id}-${opt.value}`}
              onClick={() => onSelect(id, opt.value)}
              className={`w-full text-left px-4 py-2.5 text-sm transition flex items-center gap-3 ${
                selectedValue !== undefined && opt.value === selectedValue
                  ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-purple-500/20 dark:text-white'
                  : 'text-gray-700 dark:text-slate-100 hover:bg-indigo-50 dark:hover:bg-purple-500/20 dark:hover:text-white'
              }`}
            >
              {opt.imgSrc ? (
                <img src={opt.imgSrc} alt={opt.label} className="w-5 h-auto rounded-sm shadow-sm flex-shrink-0" />
              ) : opt.icon ? (
                <span className="flex-shrink-0">{opt.icon}</span>
              ) : null}
              <span className="truncate">{opt.label}</span>
              {selectedValue !== undefined && opt.value === selectedValue ? (
                <CheckCircle className="w-4 h-4 text-indigo-600 ml-auto flex-shrink-0" />
              ) : null}
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
  openAiKey?: string;
  addLead?: (lead: Partial<Lead>) => void;
  notify?: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export default function LeadMap({ leads, discoveryResults = [], openAiKey, addLead, notify }: LeadMapProps) {
  const [selected, setSelected] = useState<SelectedLead | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | undefined>(undefined);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showClusters, setShowClusters] = useState(true);
  const [isListOpen, setIsListOpen] = useState(false);
  const mapApiRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fitToData: () => void; flyTo: (lat: number, lng: number, zoom?: number) => void } | null>(null);

  const [queryTerm, setQueryTerm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<DropdownId | 'query' | 'city', string>>>({});
  const [localDiscoveryResults, setLocalDiscoveryResults] = useState<Partial<Lead>[]>([]);
  const [noResultsPopup, setNoResultsPopup] = useState<null | { title: string; message: string; tips: string[] }>(null);
  const [openDropdown, setOpenDropdown] = useState<DropdownId | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [filters, setFilters] = useState<Filters>({
    status: 'Todos',
    minValue: 5000,
    sector: null,
    location: 'Brasil',
    state: 'Todos'
  });

  const prevVisibleCountRef = useRef<number>(0);

  useEffect(() => {
    const regions = filters.location === 'USA' ? US_STATES : BR_UF;
    if (filters.state !== 'Todos' && !regions.includes(filters.state as any)) {
      setFilters((prev) => ({ ...prev, state: 'Todos' }));
    }
  }, [filters.location]);

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
    () => [...(leads || []), ...(discoveryResults || []), ...(localDiscoveryResults || [])].filter((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng)),
    [leads, discoveryResults, localDiscoveryResults]
  );

  const sectorOptions = useMemo(() => {
    return Array.from(INDUSTRIES);
  }, []);

  const statusOptions = useMemo<DropdownOption[]>(
    () =>
      Array.from(new Set(['Todos', 'Quente', 'Morno', 'Frio', ...Object.values(PipelineStage)])).map((v) => {
        if (v === 'Todos') return { label: v, value: v, icon: <Layers className="w-4 h-4 text-gray-400 dark:text-slate-300" /> };
        const dotColor = getLeadColor({ status: v } as Partial<Lead>);
        const colorDot = (
          <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dotColor, boxShadow: `0 0 0 4px ${dotColor}20` }} />
        );
        const statusIcon = STATUS_ICONS[v] || <Layers className="w-4 h-4 text-gray-400 dark:text-slate-300" />;
        return { label: v, value: v, icon: <span className="inline-flex items-center gap-2">{statusIcon}{colorDot}</span> };
      }),
    []
  );

  const minValueOptions = useMemo<DropdownOption[]>(
    () => [0, 5000, 10000, 20000, 50000, 100000].map((n) => ({ value: String(n), label: formatThousands(n) })),
    []
  );

  const locationOptions = useMemo<DropdownOption[]>(
    () => LOCATION_OPTIONS.map((o) => ({ value: o.value, label: o.label, imgSrc: o.imgSrc })),
    []
  );

  const regionOptions = useMemo<DropdownOption[]>(() => {
    const regions = filters.location === 'USA' ? US_STATES : BR_UF;
    return ['Todos', ...regions].map((region) => ({ value: region, label: region }));
  }, [filters.location]);

  const sectorDropdownOptions = useMemo<DropdownOption[]>(
    () => [
      { value: '', label: 'Selecionar', icon: <Tag className="w-4 h-4" /> },
      ...sectorOptions.map((t) => ({ value: t, label: t, icon: INDUSTRY_ICONS[t] || <Tag className="w-4 h-4" /> }))
    ],
    [sectorOptions]
  );

  const visibleLeads = useMemo(() => {
    const status = filters.status;
    const minValue = Number.isFinite(filters.minValue) ? filters.minValue : 0;
    const sector = filters.sector;
    const region = filters.state;

    return allLeads.filter((lead) => {
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

      if (region && region !== 'Todos') {
        const hay = `${lead.city || ''} ${lead.address || ''}`.toUpperCase();
        if (!new RegExp(`\\b${region}\\b`).test(hay)) return false;
      }

      return true;
    });
  }, [allLeads, filters.minValue, filters.sector, filters.state, filters.status]);

  useEffect(() => {
    if (mapApiRef.current && visibleLeads.length > 0 && prevVisibleCountRef.current === 0) {
      mapApiRef.current.fitToData();
    }
    prevVisibleCountRef.current = visibleLeads.length;
  }, [visibleLeads.length]);

  useEffect(() => {
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
      visible: visibleLeads.length,
      total: allLeads.length,
      clusters: visibleLeads.length ? Math.max(1, Math.round(visibleLeads.length / 12)) : 0,
      topStatuses: Object.entries(
        visibleLeads.reduce<Record<string, number>>((acc, lead) => {
          const s = String((lead as any).status || '').trim();
          if (!s) return acc;
          acc[s] = (acc[s] || 0) + 1;
          return acc;
        }, {})
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([status, count]) => ({ status, count, color: getLeadColor({ status } as Partial<Lead>) }))
    }),
    [allLeads.length, visibleLeads]
  );

  const selectedDisplay = useMemo(() => {
    if (!selected) return null;
    const company = selected.company || 'Lead';
    const city = selected.city || '';
    const ufFallback = filters.state && filters.state !== 'Todos' ? filters.state : '';
    const regionList = filters.location === 'USA' ? US_STATES : BR_UF;
    const uf = extractRegionCode(`${selected.address || ''} ${selected.city || ''}`, regionList) || ufFallback;
    const status = String((selected as any).status || '—');
    const value = formatMoney((selected as any).value, filters.location);
    const address = String((selected as any).address || '').trim();
    const name = String((selected as any).name || '').trim();
    const email = String((selected as any).email || '').trim();
    const phone = String((selected as any).phone || '').trim();
    const website = String((selected as any).website || '').trim();
    const mapsUri = String((selected as any).mapsUri || '').trim();
    const source = String((selected as any).source || '').trim();
    const ratingRaw = Number((selected as any).rating);
    const rating = Number.isFinite(ratingRaw) ? ratingRaw : null;
    const tags = Array.isArray((selected as any).tags) ? ((selected as any).tags as unknown[]).map((t) => String(t || '').trim()).filter(Boolean) : [];

    return { company, city, uf, status, value, address, name, email, phone, website, mapsUri, source, rating, tags };
  }, [filters.location, filters.state, selected]);

  const statusBadgeClass = useMemo(() => {
    const s = selectedDisplay?.status || '';
    if (s === 'Quente') return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-100 dark:border-orange-400/25';
    if (s === 'Frio') return 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-100 dark:border-sky-400/25';
    if (s === PipelineStage.LOST) return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-100 dark:border-rose-400/25';
    if (s === PipelineStage.CLOSED) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-100 dark:border-emerald-400/25';
    return 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/20 dark:text-violet-100 dark:border-violet-400/25';
  }, [selectedDisplay?.status]);

  const canAddSelected = useMemo(() => {
    if (!addLead || !selected) return false;
    if (selected.id) return !leads.some((l) => l.id === selected.id);
    return true;
  }, [addLead, leads, selected]);

  const handleAddSelected = () => {
    if (!selected || !addLead) return;
    addLead(selected);
  };

  const handleToggleDropdown = (id: DropdownId) => {
    setOpenDropdown((prev) => (prev === id ? null : id));
  };

  const handleSelectDropdown = (id: DropdownId, value: string) => {
    setOpenDropdown(null);
    setFormErrors((prev) => ({ ...prev, [id]: undefined }));

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

    if (id === 'status') {
      setFilters((prev) => ({ ...prev, status: value }));
      return;
    }

    if (id === 'location') {
      setFilters((prev) => ({ ...prev, location: value }));
      return;
    }

    if (id === 'state') {
      setFilters((prev) => ({ ...prev, state: value }));
    }
  };

  const normalizeUrl = (raw: string) => {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) return v;
    return `https://${v}`;
  };

  const normalizeTel = (raw: string) => {
    const v = String(raw || '').trim();
    if (!v) return '';
    const cleaned = v.replace(/[^\d+]/g, '');
    return cleaned || v;
  };

  const validateSearchForm = () => {
    const next: Partial<Record<DropdownId | 'query' | 'city', string>> = {};
    if (!queryTerm.trim()) next.query = 'Campo obrigatório';
    if (!searchTerm.trim()) next.city = 'Campo obrigatório';
    if (!filters.sector) next.sector = 'Campo obrigatório';
    if (!filters.location) next.location = 'Campo obrigatório';
    if (!filters.state || filters.state === 'Todos') next.state = 'Campo obrigatório';
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleAiSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isSearching) return;
    if (!validateSearchForm()) {
      notify?.('Preencha todos os campos obrigatórios para buscar com IA.', 'warning');
      return;
    }

    setIsSearching(true);
    try {
      const countryName = filters.location === 'USA' ? 'USA' : 'Brasil';
      const countryCode = filters.location === 'USA' ? 'US' : 'BR';
      const industry = filters.sector || '';
      const locationForPrompt = `${searchTerm.trim()}, ${filters.state}, ${countryName}`;

      let results: Partial<Lead>[] = [];
      let perplexityError: string | null = null;
      try {
        results = await discoverLeadsWithPerplexity(queryTerm.trim(), searchTerm.trim(), filters.state, countryName, industry, '');
      } catch (err: any) {
        perplexityError = err?.message || 'Falha ao buscar via Perplexity.';
        notify?.(perplexityError, 'warning');
      }

      if (results.length === 0 && openAiKey) {
        results = await discoverLeadsWithOpenAI(queryTerm.trim(), searchTerm.trim(), filters.state, countryCode, industry, '', openAiKey);
      }

      const normalized = results
        .map((lead) => {
          const lat = Number((lead as any).lat);
          const lng = Number((lead as any).lng);
          const valueParsed = parseNumberLoose((lead as any).value);
          const value = Number.isFinite(valueParsed) && valueParsed > 0 ? valueParsed : Math.max(5000, filters.minValue || 0);

          const city = String((lead as any).city || '').trim() || searchTerm.trim();
          let address = String((lead as any).address || '').trim() || locationForPrompt;
          const regionNeedle = String(filters.state || '').toUpperCase().trim();
          if (regionNeedle) {
            const combined = `${city} ${address}`.toUpperCase();
            if (!new RegExp(`\\b${regionNeedle}\\b`).test(combined)) {
              address = `${address}, ${filters.state}`;
            }
          }

          const existingTags = Array.isArray((lead as any).tags)
            ? ((lead as any).tags as unknown[]).map((t) => String(t || '').trim()).filter(Boolean)
            : [];
          const tags = Array.from(new Set([...existingTags, ...(industry ? [industry] : []), 'Discovery']));
          const desiredStatus = filters.status && filters.status !== 'Todos' ? filters.status : (lead.status as any) || PipelineStage.NEW;

          return {
            ...lead,
            lat: Number.isFinite(lat) ? lat : 0,
            lng: Number.isFinite(lng) ? lng : 0,
            value,
            city,
            address,
            tags,
            status: desiredStatus
          } as Partial<Lead>;
        })
        .filter((lead) => {
          const lat = Number((lead as any).lat);
          const lng = Number((lead as any).lng);
          return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
        });

      if (normalized.length === 0) {
        setLocalDiscoveryResults([]);
        const title = 'Nenhum lead encontrado';
        const message = `Não encontrei leads para “${queryTerm.trim()}” em ${locationForPrompt}.`;
        const tips: string[] = [];

        if (results.length === 0) {
          if (perplexityError && !openAiKey) {
            tips.push('Perplexity falhou e não há fallback OpenAI configurado.');
            tips.push('Tente novamente em alguns segundos ou configure uma OpenAI Key nas configurações.');
          } else if (!openAiKey) {
            tips.push('Tente uma palavra-chave mais genérica (ex: “clínica”, “restaurante”, “construtora”).');
            tips.push('Teste uma cidade maior ou remova detalhes (bairro/termos muito específicos).');
          } else {
            tips.push('Tente simplificar a busca (remover detalhes) e/ou testar outra cidade/estado.');
            tips.push('Às vezes o Maps não retorna resultados em bairros pequenos; use a cidade inteira.');
          }
        } else {
          tips.push('Recebi resultados, mas sem coordenadas (lat/lng) — não dá para plotar no mapa.');
          tips.push('Sugestão: mude cidade/estado, troque o termo e tente novamente.');
        }

        if (filters.status && filters.status !== 'Todos') tips.push(`Status está filtrando (atual: “${filters.status}”). Para ver mais, use “Todos”.`);
        if (filters.minValue > 0) tips.push(`Min Valor pode estar alto (atual: ${formatThousands(filters.minValue)}). Tente reduzir.`);
        if (filters.sector) tips.push(`Setor está fixo em “${filters.sector}”. Tente outro setor para ampliar.`);

        setNoResultsPopup({ title, message, tips: tips.slice(0, 5) });
        notify?.(`${title}: ajuste a busca/filtros e tente novamente.`, 'warning');
        return;
      }

      setLocalDiscoveryResults(normalized);
      notify?.(`${normalized.length} leads encontrados e adicionados ao mapa.`, 'success');

      const first = normalized.find((l) => Number.isFinite(l.lat) && Number.isFinite(l.lng));
      if (first?.lat && first?.lng) {
        mapApiRef.current?.flyTo(Number(first.lat), Number(first.lng), 13);
      }
    } catch (error: any) {
      console.error(error);
      notify?.(error?.message || 'Erro ao buscar leads com IA.', 'warning');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto px-4 sm:px-6">
      {noResultsPopup ? (
        <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg glass-panel bg-white/95 dark:bg-slate-900/95 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-white/10 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-slate-300">Busca no Mapa</div>
                <div className="text-lg font-extrabold text-gray-900 dark:text-slate-100">{noResultsPopup.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setNoResultsPopup(null)}
                className="h-9 w-9 grid place-items-center rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-700 dark:text-slate-200">{noResultsPopup.message}</p>
              {noResultsPopup.tips.length ? (
                <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-slate-300 list-disc pl-5">
                  {noResultsPopup.tips.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setNoResultsPopup(null);
                    requestAnimationFrame(() => panelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
                  }}
                  className="rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
                >
                  Ajustar filtros
                </button>
                <button
                  type="button"
                  onClick={() => setNoResultsPopup(null)}
                  className="glass-purple px-4 py-2.5 rounded-xl text-sm font-bold"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
	      <div className="mb-6 text-center">
	        <h2 className="text-3xl font-bold text-gray-800 dark:text-slate-100 mb-2">Mapa Inteligente</h2>
	        <p className="text-gray-500 dark:text-slate-400">Filtre, visualize clusters/heatmap e importe leads para o CRM.</p>
	      </div>

      <div className="flex flex-col lg:flex-row gap-6 pb-10">
	        <aside
	          ref={panelRef}
	          className="lg:w-[320px] shrink-0 glass-panel rounded-[28px] border border-gray-200 dark:border-white/10 p-5 shadow-lg backdrop-blur-xl relative overflow-hidden"
	        >
	          <div
	            aria-hidden
	            className="absolute inset-0 opacity-35 pointer-events-none bg-[linear-gradient(to_right,rgba(34,197,94,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,197,94,0.12)_1px,transparent_1px)] bg-[size:14px_14px]"
	          />
	          <div className="relative z-10">
	            <div className="mb-6">
	              <div className="text-xs uppercase tracking-[0.28em] text-gray-500 dark:text-slate-300 mb-2">Leads</div>
	              <div className="text-2xl font-extrabold text-gray-900 dark:text-slate-100">Mapa Inteligente</div>
	            </div>

	            <form onSubmit={handleAiSearch} className="space-y-3">
	            <div className="relative">
	              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
	              <input
	                value={queryTerm}
                onChange={(e) => {
                  setQueryTerm(e.target.value);
                  setFormErrors((prev) => ({ ...prev, query: undefined }));
                }}
                className={`w-full pl-9 pr-4 py-3 border rounded-xl bg-transparent text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder:text-slate-500 ${
                  formErrors.query ? 'border-red-400' : 'border-gray-200 dark:border-slate-700'
                }`}
                placeholder="O que procurar? (ex: clínicas, restaurantes...)"
              />
              {formErrors.query ? <div className="mt-1 text-[11px] text-red-500">{formErrors.query}</div> : null}
            </div>

            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 pointer-events-none" />
              <input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFormErrors((prev) => ({ ...prev, city: undefined }));
                }}
                className={`w-full pl-9 pr-4 py-3 border rounded-xl bg-transparent text-gray-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400 dark:placeholder:text-slate-500 ${
                  formErrors.city ? 'border-red-400' : 'border-gray-200 dark:border-slate-700'
                }`}
                placeholder="Cidade (ex: Brooklyn)"
              />
	              {formErrors.city ? <div className="mt-1 text-[11px] text-red-500">{formErrors.city}</div> : null}
	            </div>

            <div className="space-y-3 pt-1">
              <DropdownRow
                id="status"
                label="Status"
                value={filters.status || 'Todos'}
                selectedValue={filters.status || 'Todos'}
                icon={<Layers className="w-4 h-4" />}
                open={openDropdown === 'status'}
                options={statusOptions}
                onToggle={handleToggleDropdown}
                onSelect={handleSelectDropdown}
              />

              <DropdownRow
                id="minValue"
                label="Min Valor"
                value={formatThousands(filters.minValue)}
                selectedValue={String(filters.minValue)}
                icon={<DollarSign className="w-4 h-4" />}
                open={openDropdown === 'minValue'}
                options={minValueOptions}
                onToggle={handleToggleDropdown}
                onSelect={handleSelectDropdown}
              />

              <DropdownRow
                id="sector"
                label="Setor"
                value={filters.sector || 'Selecionar'}
                selectedValue={filters.sector || ''}
                icon={<Tag className="w-4 h-4" />}
                open={openDropdown === 'sector'}
                options={sectorDropdownOptions}
                onToggle={handleToggleDropdown}
                onSelect={handleSelectDropdown}
              />
              {formErrors.sector ? <div className="-mt-2 text-[11px] text-red-500">{formErrors.sector}</div> : null}

	              <DropdownRow
	                id="location"
	                label="Localização"
	                value={filters.location || 'Brasil'}
	                selectedValue={filters.location || 'Brasil'}
	                icon={<Globe className="w-4 h-4" />}
	                open={openDropdown === 'location'}
	                options={locationOptions}
	                onToggle={handleToggleDropdown}
	                onSelect={handleSelectDropdown}
	              />

	              <DropdownRow
                id="state"
                label="Estado"
                value={filters.state || 'Todos'}
                selectedValue={filters.state || 'Todos'}
                icon={<MapPin className="w-4 h-4" />}
                open={openDropdown === 'state'}
                options={regionOptions}
                onToggle={handleToggleDropdown}
                onSelect={handleSelectDropdown}
              />
              {formErrors.state ? <div className="-mt-2 text-[11px] text-red-500">{formErrors.state}</div> : null}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="glass-purple w-full disabled:opacity-60 text-white px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
            >
              {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Procurar
            </button>

            <button
              type="button"
              onClick={() => {
                setQueryTerm('');
                setSearchTerm('');
                setOpenDropdown(null);
                setFilters({ status: 'Todos', minValue: 0, sector: null, location: 'Brasil', state: 'Todos' });
                setLocalDiscoveryResults([]);
                setFormErrors({});
              }}
              className="w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
            >
              Limpar filtros
            </button>
	            </form>
	          </div>
	        </aside>

        <main className="flex-1">
          <div className="mb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-2xl border border-gray-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 px-4 py-3 backdrop-blur">
            <div className="text-sm text-gray-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>
                Mostrando <span className="font-extrabold text-gray-900 dark:text-slate-100">{totals.visible}</span> de{' '}
                <span className="font-extrabold text-gray-900 dark:text-slate-100">{totals.total}</span>
              </span>
              <span className="mx-3 h-4 w-px bg-gray-200 dark:bg-white/10 inline-block align-middle" />
              <span>
                Clusters: <span className="font-extrabold text-gray-900 dark:text-slate-100">{totals.clusters}</span>
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {totals.topStatuses.map((s) => (
                <span
                  key={s.status}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-2.5 py-1 text-[11px] text-gray-600 dark:text-white/75"
                >
                  <span className="inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 0 4px ${s.color}20` }} />
                  {s.status} • <span className="font-extrabold text-gray-900 dark:text-slate-100">{s.count}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="relative h-[540px] md:h-[620px] lg:h-[680px] overflow-hidden rounded-[34px] border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0b0b1f]/40 shadow-lg">
            <div className="absolute inset-0 z-0">
              <LeafletEngine
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

              {isListOpen ? (
                <div className="absolute inset-0 z-40 bg-black/35 backdrop-blur-sm">
                  <div className="absolute left-1/2 top-1/2 w-[520px] max-w-[calc(100%-40px)] -translate-x-1/2 -translate-y-1/2 rounded-[28px] border border-gray-200 dark:border-white/10 glass-panel bg-white/95 dark:bg-slate-900/95 shadow-2xl backdrop-blur-xl overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10 px-5 py-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.22em] text-gray-500 dark:text-slate-300">Lista</div>
                        <div className="text-lg font-extrabold text-gray-900 dark:text-slate-100">Leads ({visibleLeads.length})</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsListOpen(false)}
                        className="h-9 w-9 grid place-items-center rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] text-gray-700 dark:text-white/80 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition"
                        aria-label="Fechar"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="max-h-[520px] overflow-y-auto custom-scrollbar p-3">
                      {visibleLeads.slice(0, 120).map((lead, idx) => {
                        const featureId = getLeadFeatureId(lead, idx);
                        const active = featureId === selectedFeatureId;
                        const markerColor = getLeadColor(lead);

                        return (
                          <button
                            key={featureId}
                            type="button"
                            onClick={() => {
                              setSelected(lead);
                              setSelectedFeatureId(featureId);
                              setIsListOpen(false);
                              mapApiRef.current?.flyTo(Number(lead.lat), Number(lead.lng), 13);
                            }}
                            className={`w-full text-left rounded-2xl border px-4 py-2.5 mb-2 transition ${
                              active
                                ? 'border-indigo-300 bg-indigo-50/70 dark:border-violet-400/40 dark:bg-white/[0.08]'
                                : 'border-gray-200 bg-white/70 hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07] dark:hover:border-violet-400/30'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="inline-flex h-2.5 w-2.5 rounded-full"
                                    style={{ backgroundColor: markerColor, boxShadow: `0 0 0 4px ${markerColor}22, 0 0 18px ${markerColor}66` }}
                                  />
                                  <span className="font-bold text-gray-900 dark:text-white truncate">{lead.company || 'Lead'}</span>
                                </div>
                                <div className="mt-1 text-xs text-gray-500 dark:text-white/55 truncate">{lead.city || lead.address || '—'}</div>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-bold text-gray-600 dark:text-white/70">{String((lead as any).status || '')}</div>
                                <div className="mt-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">{formatMoney((lead as any).value, filters.location)}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {visibleLeads.length > 120 ? <div className="px-2 py-2 text-xs text-gray-500 dark:text-white/45">Mostrando 120 de {visibleLeads.length} resultados.</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}

            <div className="absolute right-4 top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2.5">
              <ControlButton onClick={() => mapApiRef.current?.zoomIn()}>
                <Plus className="h-4 w-4" />
              </ControlButton>
              <ControlButton onClick={() => mapApiRef.current?.zoomOut()}>
                <Minus className="h-4 w-4" />
              </ControlButton>
              <ControlButton onClick={() => setShowClusters((v) => !v)}>
                <Layers className="h-4 w-4" />
              </ControlButton>
              <ControlButton onClick={() => mapApiRef.current?.fitToData()}>
                <Home className="h-4 w-4" />
              </ControlButton>
            </div>

            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1.5 rounded-full border border-gray-200/70 dark:border-white/10 glass-panel bg-white/90 dark:bg-white/10 px-2.5 py-1.5 backdrop-blur">
              <TogglePill active={showHeatmap} onClick={() => setShowHeatmap((v) => !v)}>
                <Flame className="h-4 w-4 text-amber-500" /> Heatmap
              </TogglePill>
              <TogglePill active={showClusters} onClick={() => setShowClusters((v) => !v)}>
                <Layers className="h-4 w-4 text-indigo-600 dark:text-violet-300" /> Clusters
              </TogglePill>
              <TogglePill active={isListOpen} simpleActive onClick={() => setIsListOpen((v) => !v)}>
                <List className="h-4 w-4 text-gray-500 dark:text-white/70" /> Ver Lista
              </TogglePill>
            </div>

            <div className="absolute bottom-4 right-4 z-30 w-[300px] rounded-[24px] border border-gray-200/70 dark:border-white/10 glass-panel bg-white/90 dark:bg-slate-900/70 p-4 shadow-xl backdrop-blur-xl">
              <div className="mb-2 flex items-center gap-2 text-gray-500 dark:text-violet-200/90 text-xs uppercase tracking-[0.22em]">
                <Layers className="h-4 w-4" /> Lead Selecionado
              </div>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white leading-tight">{selectedDisplay?.company || '—'}</p>
              <p className="mt-1 text-gray-600 dark:text-white/60">
                {selectedDisplay?.city || '—'}
                {selectedDisplay?.uf ? `, ${selectedDisplay.uf}` : ''}
              </p>
              {selectedDisplay?.address ? <p className="mt-2 text-xs text-gray-500 dark:text-white/45 line-clamp-2">{selectedDisplay.address}</p> : null}

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-white/60">Status</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold border ${statusBadgeClass}`}>{selectedDisplay?.status || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 dark:text-white/60">Valor</span>
                  <span className="font-extrabold text-emerald-700 dark:text-emerald-300">{selectedDisplay?.value || '—'}</span>
                </div>

                {selectedDisplay?.source ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-white/60">Fonte</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/85">{selectedDisplay.source}</span>
                  </div>
                ) : null}

                {typeof selectedDisplay?.rating === 'number' ? (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-white/60">Avaliação</span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-white/85">{selectedDisplay.rating.toFixed(1)} ★</span>
                  </div>
                ) : null}

                {selectedDisplay?.name || selectedDisplay?.phone || selectedDisplay?.email ? (
                  <div className="pt-3 border-t border-gray-200 dark:border-white/10 space-y-1">
                    {selectedDisplay?.name ? <div className="text-xs text-gray-600 dark:text-white/70">Contato: <span className="text-gray-900 dark:text-white/90 font-semibold">{selectedDisplay.name}</span></div> : null}
                    {selectedDisplay?.phone ? (
                      <div className="text-xs text-gray-600 dark:text-white/70">
                        Tel:{' '}
                        <a
                          href={`tel:${normalizeTel(selectedDisplay.phone)}`}
                          className="text-gray-900 dark:text-white/90 font-semibold hover:underline underline-offset-2 break-words"
                        >
                          {selectedDisplay.phone}
                        </a>
                      </div>
                    ) : null}
                    {selectedDisplay?.email ? (
                      <div className="text-xs text-gray-600 dark:text-white/70">
                        Email:{' '}
                        <a
                          href={`mailto:${selectedDisplay.email}`}
                          className="text-gray-900 dark:text-white/90 font-semibold hover:underline underline-offset-2 break-words"
                        >
                          {selectedDisplay.email}
                        </a>
                      </div>
                    ) : null}
                    {selectedDisplay?.website ? (
                      <div className="text-xs text-gray-600 dark:text-white/70">
                        Site:{' '}
                        <a
                          href={normalizeUrl(selectedDisplay.website)}
                          target="_blank"
                          rel="noreferrer"
                          title={selectedDisplay.website}
                          className="text-indigo-700 dark:text-indigo-200 font-semibold hover:underline underline-offset-2 break-all"
                        >
                          {selectedDisplay.website}
                        </a>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {selectedDisplay?.tags?.length ? (
                  <div className="pt-3 border-t border-gray-200 dark:border-white/10">
                    <div className="flex flex-wrap gap-2">
                      {selectedDisplay.tags.slice(0, 6).map((t) => (
                        <span key={t} className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-1 text-[10px] text-indigo-700 dark:bg-white/[0.06] dark:border-white/10 dark:text-white/80">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {canAddSelected || selectedDisplay?.mapsUri ? (
                <div className="mt-4 flex items-center gap-2">
                  {canAddSelected ? (
                    <button type="button" onClick={handleAddSelected} className="glass-purple flex-1 px-4 py-2.5 rounded-2xl text-sm font-bold">
                      Adicionar ao CRM
                    </button>
                  ) : null}
                  {selectedDisplay?.mapsUri ? (
                    <a
                      href={selectedDisplay.mapsUri}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-center rounded-2xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/[0.04] px-4 py-2.5 text-sm font-bold text-gray-700 dark:text-white/85 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
                    >
                      Abrir Maps
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="pointer-events-none absolute bottom-2 left-4 z-20 text-xs text-gray-500 dark:text-white/45">
              * Mapa integrado com OpenStreetMap e cluster de leads. Clique nos marcadores para ver detalhes.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
