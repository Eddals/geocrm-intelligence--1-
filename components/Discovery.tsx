
import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, PlusCircle, Globe, MapPin, Download, Building, User, Mail, Phone, DollarSign, Filter, Linkedin, Star, Link, ArrowRight, CheckCircle, XCircle, Instagram, Facebook, AlertOctagon, RefreshCw, ChevronDown, Sparkles } from 'lucide-react';
import { discoverLeads } from '../services/geminiService';
import { discoverLeadsWithOpenAI } from '../services/openaiService';
import { extractAndQualifyWithPerplexity } from '../services/perplexityScraperService';
import { Lead, PipelineStage } from '../types';

interface DiscoveryProps {
  addLeads: (leads: Partial<Lead>[]) => void;
  openAiKey?: string;
  setDiscoveryResults?: (results: Partial<Lead>[]) => void;
  userSector?: string;
}

const INDUSTRIES = [
    "Tecnologia e Software",
    "Saúde e Medicina",
    "Imobiliário",
    "Restaurantes e Alimentação",
    "Varejo e E-commerce",
    "Construção e Engenharia",
    "Serviços Financeiros",
    "Serviços Jurídicos",
    "Marketing e Publicidade",
    "Educação",
    "Indústria e Manufatura",
    "Logística e Transporte",
    "Turismo e Hotelaria"
];

const RATING_OPTIONS = [
    { value: "", label: "Qualquer" },
    { value: "low", label: "Baixo (1-2★)" },
    { value: "medium", label: "Médio (3-4★)" },
    { value: "high", label: "Alto (4.5+★)" }
];

// Data for Countries and States
const LOCATIONS = {
    BR: {
        name: "Brasil",
        flag: "https://flagcdn.com/w40/br.png",
        states: [
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
        ]
    },
    US: {
        name: "USA",
        flag: "https://flagcdn.com/w40/us.png",
        states: [
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
        ]
    }
};

const Discovery: React.FC<DiscoveryProps> = ({ addLeads, openAiKey, setDiscoveryResults, userSector }) => {
  const [activeTab, setActiveTab] = useState<'ai' | 'scraper' | 'manual'>('ai');

  // AI Search State
  const [query, setQuery] = useState('');
  const [country, setCountry] = useState<'BR' | 'US'>('BR');
  const [region, setRegion] = useState(''); // State/Province
  const [city, setCity] = useState('');
  const [industry, setIndustry] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');

  // Dropdown States
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  // Scraper State
  const [targetUrl, setTargetUrl] = useState('');
  const [scrapedLead, setScrapedLead] = useState<Partial<Lead> | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Partial<Lead>[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);

  // Manual Form State
  const initialForm = {
    company: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    value: '',
    notes: ''
  };
  const [manualForm, setManualForm] = useState(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset region when country changes
  useEffect(() => {
      setRegion('');
  }, [country]);

  // Handle click outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (countryRef.current && !countryRef.current.contains(event.target as Node)) {
            setIsCountryOpen(false);
        }
        if (regionRef.current && !regionRef.current.contains(event.target as Node)) {
            setIsRegionOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
        document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Helper to check if data is valid (not null, not empty, not "null" string)
  const isValid = (value: string | null | undefined) => {
      if (!value) return false;
      const v = String(value).trim().toLowerCase();
      return v !== '' && v !== 'null' && v !== 'undefined' && v !== 'n/a' && v !== 'gerente' && v !== 'não encontrado' && v !== 'não detectado';
  };

  // --- Search Handler ---
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !city) return;

    setIsLoading(true);
    setResults([]);
    if (setDiscoveryResults) setDiscoveryResults([]);
    
    try {
      let data: Partial<Lead>[] = [];
      
      if (openAiKey) {
          data = await discoverLeadsWithOpenAI(query, city, region, country, industry, ratingFilter, openAiKey);
      } else {
          data = await discoverLeads(query, city, region, country, industry, ratingFilter);
      }
      
      if (data.length === 0) {
          alert("Nenhum resultado encontrado. Tente modificar sua busca.");
      }
      setResults(data);
      if (setDiscoveryResults) setDiscoveryResults(data);
    } catch (error: any) {
        console.error("Erro na busca:", error);
        alert(error.message || "Ocorreu um erro ao buscar leads. Verifique sua conexão ou API Key.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Scraper Handler (UPDATED TO USE YOU.COM) ---
  const handleScrape = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!targetUrl) return;

      setIsLoading(true);
      setScrapedLead(null);

      try {
          // Use Perplexity API Service
          const data = await extractAndQualifyWithPerplexity(targetUrl);
          setScrapedLead(data);
      } catch (error: any) {
          console.error("Erro no scraping:", error);
          alert(`Erro na extração: ${error.message || "Verifique a URL e tente novamente."}`);
      } finally {
          setIsLoading(false);
      }
  };

  const handleImportScraped = () => {
      if (scrapedLead) {
          addLeads([scrapedLead]);
          setScrapedLead(null);
          setTargetUrl('');
          alert("Lead importado com sucesso!");
      }
  };

  const toggleSelection = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };

  const handleImport = () => {
    const leadsToImport = results.filter((_, idx) => selectedIndices.includes(idx));
    addLeads(leadsToImport);
    setResults([]);
    if (setDiscoveryResults) setDiscoveryResults([]);
    setSelectedIndices([]);
    setQuery('');
  };

  // --- Manual Handlers ---
  const handleManualChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setManualForm({ ...manualForm, [e.target.name]: e.target.value });
    if (errors[e.target.name]) {
        setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validateManualForm = () => {
      const newErrors: Record<string, string> = {};
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

      if (!manualForm.company.trim()) newErrors.company = "Nome da empresa é obrigatório.";
      if (!manualForm.city.trim()) newErrors.city = "Cidade é obrigatória.";
      if (manualForm.email && !emailRegex.test(manualForm.email)) newErrors.email = "Email inválido.";
      if (Number(manualForm.value) < 0) newErrors.value = "Valor não pode ser negativo.";

      return newErrors;
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationErrors = validateManualForm();
    if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
        return;
    }

    const newLead: Partial<Lead> = {
      company: manualForm.company,
      name: manualForm.name || manualForm.company,
      email: manualForm.email || null,
      phone: manualForm.phone || null,
      address: manualForm.address || 'Endereço não informado',
      city: manualForm.city,
      value: Number(manualForm.value) || 0,
      notes: manualForm.notes,
      status: PipelineStage.NEW,
      source: 'Manual',
      tags: ['Manual'],
      enriched: false,
      lat: 0,
      lng: 0,
    };

    addLeads([newLead]);
    setManualForm(initialForm);
    setErrors({});
  };

  const renderStars = (rating: number) => {
      const r = rating || 4.5; 
      const stars = [];
      for (let i = 1; i <= 5; i++) {
          if (i <= r) {
              stars.push(<Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />);
          } else if (i - 0.5 <= r) {
               stars.push(<Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400 opacity-50" />);
          } else {
              stars.push(<Star key={i} className="w-3 h-3 text-gray-300" />);
          }
      }
      return <div className="flex gap-0.5">{stars}</div>;
  };

  const handleResetScraper = () => {
    setScrapedLead(null);
    setTargetUrl('');
  };

  const handleIndustrySelect = (ind: string) => {
      // Toggle logic: if clicking the selected one, deselect it
      if (industry === ind) {
          setIndustry('');
      } else {
          setIndustry(ind);
      }
  };

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      <div className="mb-6 text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Captação de Leads</h2>
        <p className="text-gray-500">Adicione novos leads manualmente, via site ou utilize nossa IA.</p>
      </div>

      <div className="flex justify-center mb-8">
        <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex gap-2">
            <button
                onClick={() => setActiveTab('ai')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'ai' ? 'bg-gray-100 text-gray-900 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                Busca Automática (IA)
            </button>
            <button
                onClick={() => setActiveTab('scraper')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'scraper' ? 'bg-gray-100 text-gray-900 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                Extração por Site (Perplexity)
            </button>
            <button
                onClick={() => setActiveTab('manual')}
                className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-gray-100 text-gray-900 font-semibold shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
            >
                Manual
            </button>
        </div>
      </div>

      {activeTab === 'ai' && (
        <>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 mb-8 animate-fade-in">
            {/* Header - CLEAN STYLE */}
            <div className="flex items-center gap-5 border-b border-gray-100 p-6 rounded-t-2xl">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Search className="w-6 h-6 text-indigo-600" />
                        Busca Inteligente
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Encontre empresas e contatos automaticamente.</p>
                </div>
            </div>

            <form onSubmit={handleSearch} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Search Query */}
                <div className="md:col-span-12 lg:col-span-4 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                    type="text"
                    placeholder="Ex: Startups, Clínicas, Nome da Empresa..."
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    />
                </div>

                {/* Country Selector - Custom Dropdown */}
                <div className="md:col-span-4 lg:col-span-2 relative" ref={countryRef}>
                    <button
                        type="button"
                        onClick={() => setIsCountryOpen(!isCountryOpen)}
                        className="w-full pl-4 pr-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all flex items-center justify-between"
                    >
                        <div className="flex items-center gap-2">
                            <img src={LOCATIONS[country].flag} alt={country} className="w-5 h-auto rounded-sm shadow-sm" />
                            <span className="text-sm">{LOCATIONS[country].name}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCountryOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isCountryOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                            {Object.entries(LOCATIONS).map(([code, data]) => (
                                <div
                                    key={code}
                                    onClick={() => {
                                        setCountry(code as 'BR' | 'US');
                                        setIsCountryOpen(false);
                                    }}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
                                >
                                    <img src={data.flag} alt={code} className="w-5 h-auto rounded-sm shadow-sm" />
                                    <span className="text-sm font-medium text-gray-700">{data.name}</span>
                                    {country === code && <CheckCircle className="w-3 h-3 text-indigo-600 ml-auto" />}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* State Selector - Custom Dropdown */}
                <div className="md:col-span-4 lg:col-span-3 relative" ref={regionRef}>
                    <button
                        type="button"
                        onClick={() => setIsRegionOpen(!isRegionOpen)}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none transition-all flex items-center justify-between text-left"
                    >
                        <span className={`text-sm ${!region ? 'text-gray-500' : 'text-gray-900'}`}>
                            {region || "Estado (Todos)"}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isRegionOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isRegionOpen && (
                        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto custom-scrollbar">
                            <div
                                onClick={() => {
                                    setRegion('');
                                    setIsRegionOpen(false);
                                }}
                                className={`px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm transition-colors ${!region ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                            >
                                Estado (Todos)
                            </div>
                            {LOCATIONS[country].states.map(s => (
                                <div
                                    key={s}
                                    onClick={() => {
                                        setRegion(s);
                                        setIsRegionOpen(false);
                                    }}
                                    className={`px-4 py-2.5 hover:bg-gray-50 cursor-pointer text-sm transition-colors ${region === s ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                                >
                                    {s}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* City Input */}
                <div className="md:col-span-4 lg:col-span-3 relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                    type="text"
                    placeholder="Cidade / Bairro"
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    />
                </div>
              </div>

              {/* Row 2: Reputation Filter as Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="col-span-12">
                      <label className="text-xs font-bold text-gray-500 uppercase mb-2 block flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" /> Reputação
                      </label>
                      <div className="flex flex-wrap gap-2">
                          {RATING_OPTIONS.map((opt) => (
                              <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setRatingFilter(opt.value)}
                                  className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                                      ratingFilter === opt.value
                                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm ring-1 ring-indigo-300'
                                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                  }`}
                              >
                                  {opt.label}
                              </button>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Row 3: Action Button */}
              <div className="mt-2">
                     <button
                        type="submit"
                        disabled={isLoading || !query || !city}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100"
                    >
                        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Buscar'}
                    </button>
              </div>

               {/* Industry Tags Selection */}
               <div className="pt-4 border-t border-gray-100">
                  <label className="text-xs font-bold text-gray-500 uppercase mb-3 block flex items-center gap-2">
                      <Filter className="w-4 h-4" /> Filtrar por Indústria
                  </label>
                  <div className="flex flex-wrap gap-2">
                      <button
                          type="button"
                          onClick={() => setIndustry('')}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                              industry === '' 
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                          }`}
                      >
                          Todas
                      </button>
                      {INDUSTRIES.map(ind => (
                          <button
                              key={ind}
                              type="button"
                              onClick={() => handleIndustrySelect(ind)}
                              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                  industry === ind 
                                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200' 
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                              }`}
                          >
                              {ind}
                          </button>
                      ))}
                  </div>
              </div>

            </form>
             {openAiKey && <p className="text-xs text-center text-green-600 mt-4 font-medium">✨ Usando OpenAI GPT-4 para resultados otimizados</p>}
          </div>

          {results.length > 0 && (
            <div className="flex-1 flex flex-col animate-fade-in">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-700">Resultados Encontrados ({results.length})</h3>
                <button 
                    onClick={handleImport}
                    disabled={selectedIndices.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                    <Download className="w-4 h-4" /> Importar ({selectedIndices.length})
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((lead, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => toggleSelection(idx)}
                    className={`cursor-pointer group relative p-5 rounded-xl border transition-all duration-200 ${
                        selectedIndices.includes(idx) 
                        ? 'bg-indigo-50 border-indigo-500 shadow-md ring-1 ring-indigo-500' 
                        : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-xl">
                            🏢
                        </div>
                        {selectedIndices.includes(idx) && (
                            <div className="text-indigo-600">
                                <PlusCircle className="w-5 h-5 fill-indigo-100" />
                            </div>
                        )}
                    </div>
                    <div className="mb-2">
                        <h4 className="font-bold text-gray-800 text-lg leading-tight">{lead.company}</h4>
                         <div className="mt-1 flex items-center gap-2">
                            {renderStars(lead.rating || 0)}
                            <span className="text-[10px] text-gray-400 font-medium">
                                {lead.rating ? lead.rating.toFixed(1) : ''}
                            </span>
                        </div>
                    </div>
                    
                    {isValid(lead.name) && (
                        <p className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-indigo-600" />
                            {lead.name}
                        </p>
                    )}

                    <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
                        <MapPin className="w-3 h-3" /> {isValid(lead.address) ? `${lead.address}, ${lead.city}` : lead.city}
                    </p>

                    {(isValid(lead.website) || isValid(lead.linkedin) || isValid(lead.instagram) || isValid(lead.facebook)) ? (
                        <div className="flex gap-2 pt-3 border-t border-gray-100">
                            {isValid(lead.website) && (
                                <a 
                                    href={lead.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded"
                                    title="Website"
                                >
                                    <Globe className="w-4 h-4" />
                                </a>
                            )}
                            {isValid(lead.linkedin) && (
                                <a 
                                    href={lead.linkedin} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-1 hover:bg-blue-50 rounded"
                                    title="LinkedIn"
                                >
                                    <Linkedin className="w-4 h-4" />
                                </a>
                            )}
                            {isValid(lead.instagram) && (
                                <a 
                                    href={lead.instagram} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-400 hover:text-pink-600 transition-colors p-1 hover:bg-pink-50 rounded"
                                    title="Instagram"
                                >
                                    <Instagram className="w-4 h-4" />
                                </a>
                            )}
                            {isValid(lead.facebook) && (
                                <a 
                                    href={lead.facebook} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-gray-400 hover:text-blue-700 transition-colors p-1 hover:bg-blue-50 rounded"
                                    title="Facebook"
                                >
                                    <Facebook className="w-4 h-4" />
                                </a>
                            )}
                        </div>
                    ) : (
                        <p className="text-[10px] text-gray-400 italic pt-2 border-t border-gray-100">Redes sociais não disponíveis</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'scraper' && (
        <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-fade-in">
           <div className="text-center mb-8">
               <h3 className="font-bold text-xl text-gray-800 mb-2 flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6 text-indigo-600" />
                    Extração & Qualificação (Perplexity IA)
                </h3>
                <p className="text-sm text-gray-500 max-w-lg mx-auto">
                    Insira o site. Nossa IA analisará a página para extrair contatos, redes sociais e 
                    <strong> qualificar o lead</strong> (status, profissionalismo, nicho e poder de compra).
                </p>
           </div>
           
           <form onSubmit={handleScrape} className="flex gap-2 mb-8">
               <div className="relative flex-1">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input 
                        type="url"
                        placeholder="https://www.exemplo.com.br"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        required
                    />
               </div>
               <button 
                type="submit"
                disabled={isLoading || !targetUrl}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-semibold transition-all flex items-center gap-2 disabled:opacity-50"
               >
                   {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analisar Site'}
               </button>
           </form>

           {scrapedLead && (
               <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 animate-in zoom-in-95 duration-200">
                   
                   {/* DEAD LEAD ALERT */}
                   {!isValid(scrapedLead.email) && !isValid(scrapedLead.phone) && (
                       <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <div className="p-2 bg-red-100 rounded-full shrink-0">
                                <AlertOctagon className="w-6 h-6 text-red-600" />
                            </div>
                            <div>
                                <h4 className="font-bold text-red-700 text-lg">⚠️ Lead Fraco Detectado</h4>
                                <p className="text-sm text-red-600 mt-1">
                                    Não encontramos email ou telefone explícitos. A IA pode ter qualificado o site, mas o contato direto é difícil.
                                </p>
                            </div>
                       </div>
                   )}

                   <div className="flex justify-between items-start mb-4">
                       <div>
                           <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded border border-indigo-200 mb-2 inline-block">
                               Análise de Qualificação Concluída
                           </span>
                           <h2 className="text-2xl font-bold text-gray-800">{scrapedLead.company}</h2>
                           {isValid(scrapedLead.website) && (
                               <a href={scrapedLead.website} target="_blank" className="text-indigo-600 text-sm hover:underline flex items-center gap-1 mt-1">
                                   {scrapedLead.website} <Globe className="w-3 h-3" />
                               </a>
                           )}
                       </div>
                       <div className="flex gap-2">
                           <button 
                            onClick={handleResetScraper}
                            className="text-gray-500 hover:text-gray-700 px-3 py-2 text-sm font-medium"
                           >
                               Limpar
                           </button>
                           <button 
                            onClick={handleImportScraped}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm"
                           >
                               <Download className="w-4 h-4" /> Importar Lead
                           </button>
                       </div>
                   </div>

                   <div className="grid grid-cols-2 gap-6 bg-white p-4 rounded-lg border border-gray-100 shadow-sm mb-4">
                       <div className="space-y-3">
                           <div>
                               <p className="text-xs text-gray-500 font-bold uppercase">Email</p>
                               {isValid(scrapedLead.email) ? (
                                <div className="flex items-center gap-2 text-gray-800 text-sm">
                                   <Mail className="w-4 h-4 text-gray-400" /> 
                                   <span className="text-gray-800">{scrapedLead.email}</span>
                                   <CheckCircle className="w-4 h-4 text-emerald-500" />
                                </div>
                               ) : (
                                   <p className="text-sm text-red-400 italic">Não encontrado</p>
                               )}
                           </div>
                           <div>
                               <p className="text-xs text-gray-500 font-bold uppercase">Telefone</p>
                               {isValid(scrapedLead.phone) ? (
                                <div className="flex items-center gap-2 text-gray-800 text-sm">
                                   <Phone className="w-4 h-4 text-gray-400" /> 
                                   <span className="text-gray-800">{scrapedLead.phone}</span>
                                </div>
                               ) : (
                                   <p className="text-sm text-red-400 italic">Não encontrado</p>
                               )}
                           </div>
                       </div>
                       <div className="space-y-3">
                           {isValid(scrapedLead.city) && (
                               <div>
                                   <p className="text-xs text-gray-500 font-bold uppercase">Localização</p>
                                    <div className="flex items-center gap-2 text-gray-800 text-sm">
                                       <MapPin className="w-4 h-4 text-gray-400" /> {scrapedLead.city}
                                       {isValid(scrapedLead.address) && <span className="text-xs text-gray-500 ml-1">({scrapedLead.address})</span>}
                                   </div>
                               </div>
                           )}
                           {(isValid(scrapedLead.instagram) || isValid(scrapedLead.facebook) || isValid(scrapedLead.linkedin)) && (
                               <div>
                                   <p className="text-xs text-gray-500 font-bold uppercase mb-1">Redes Sociais</p>
                                   <div className="flex gap-3">
                                        {isValid(scrapedLead.instagram) && <a href={scrapedLead.instagram!.startsWith('http') ? scrapedLead.instagram : `https://${scrapedLead.instagram}`} target="_blank" className="text-pink-600 hover:scale-110 transition-transform"><Instagram className="w-5 h-5"/></a>}
                                        {isValid(scrapedLead.facebook) && <a href={scrapedLead.facebook!.startsWith('http') ? scrapedLead.facebook : `https://${scrapedLead.facebook}`} target="_blank" className="text-blue-700 hover:scale-110 transition-transform"><Facebook className="w-5 h-5"/></a>}
                                        {isValid(scrapedLead.linkedin) && <a href={scrapedLead.linkedin!.startsWith('http') ? scrapedLead.linkedin : `https://${scrapedLead.linkedin}`} target="_blank" className="text-blue-500 hover:scale-110 transition-transform"><Linkedin className="w-5 h-5"/></a>}
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>

                   {/* QUALIFICATION REPORT */}
                   {scrapedLead.notes && (
                       <div className="bg-indigo-50/50 rounded-lg border border-indigo-100 p-4">
                           <h4 className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-2">
                               <Sparkles className="w-4 h-4 text-indigo-600" /> Relatório de Qualificação (Perplexity)
                           </h4>
                           <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                               {scrapedLead.notes}
                           </div>
                       </div>
                   )}
               </div>
           )}
        </div>
      )}

      {/* Manual Tab */}
      {activeTab === 'manual' && (
        <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 animate-fade-in">
             <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2 pb-4 border-b border-gray-100">
                <PlusCircle className="w-6 h-6 text-indigo-600" />
                Cadastro Manual de Lead
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-6">
                {/* Inputs ... */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Empresa / Negócio *</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="company"
                                value={manualForm.company}
                                onChange={handleManualChange}
                                placeholder="Ex: Tech Solutions Ltda"
                                className={`w-full pl-10 pr-4 py-2.5 border ${errors.company ? 'border-red-500' : 'border-gray-200'} rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400`}
                            />
                        </div>
                        {errors.company && <p className="text-xs text-red-500">{errors.company}</p>}
                    </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nome do Contato</label>
                         <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="name"
                                value={manualForm.name}
                                onChange={handleManualChange}
                                placeholder="Ex: João Silva"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="email"
                                type="email"
                                value={manualForm.email}
                                onChange={handleManualChange}
                                placeholder="contato@empresa.com"
                                className={`w-full pl-10 pr-4 py-2.5 border ${errors.email ? 'border-red-500' : 'border-gray-200'} rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400`}
                            />
                        </div>
                        {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Telefone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="phone"
                                value={manualForm.phone}
                                onChange={handleManualChange}
                                placeholder="(00) 00000-0000"
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cidade *</label>
                         <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="city"
                                value={manualForm.city}
                                onChange={handleManualChange}
                                placeholder="Ex: São Paulo"
                                className={`w-full pl-10 pr-4 py-2.5 border ${errors.city ? 'border-red-500' : 'border-gray-200'} rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400`}
                            />
                        </div>
                        {errors.city && <p className="text-xs text-red-500">{errors.city}</p>}
                    </div>
                     <div className="space-y-2">
                         <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Estimado ($)</label>
                         <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                name="value"
                                type="number"
                                value={manualForm.value}
                                onChange={handleManualChange}
                                placeholder="0.00"
                                className={`w-full pl-10 pr-4 py-2.5 border ${errors.value ? 'border-red-500' : 'border-gray-200'} rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400`}
                            />
                        </div>
                        {errors.value && <p className="text-xs text-red-500">{errors.value}</p>}
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Endereço Completo</label>
                    <input
                        name="address"
                        value={manualForm.address}
                        onChange={handleManualChange}
                        placeholder="Rua, Número, Bairro, CEP"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Notas / Observações</label>
                    <textarea
                        name="notes"
                        rows={3}
                        value={manualForm.notes}
                        onChange={handleManualChange}
                        placeholder="Detalhes adicionais sobre o lead..."
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-lg bg-transparent text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none placeholder-gray-400"
                    />
                </div>
                <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                        type="submit"
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2"
                    >
                        <PlusCircle className="w-5 h-5" />
                        Cadastrar Lead
                    </button>
                </div>
            </form>
        </div>
      )}
    </div>
  );
};

export default Discovery;
