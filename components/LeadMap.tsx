
import React, { useEffect, useRef, useState } from 'react';
import { Lead, PipelineStage } from '../types';
import { MapPin, Layers, Maximize2, Search, Loader2, User, Filter, ListOrdered, ChevronDown, Check, CheckCircle2 } from 'lucide-react';
import { findNearbyPlaces } from '../services/geminiService';
import { findNearbyPlacesWithOpenAI } from '../services/openaiService';

interface LeadMapProps {
  leads: Lead[];
  discoveryResults?: Partial<Lead>[];
  openAiKey?: string;
  addLead?: (lead: Partial<Lead>) => void;
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

// Data for Countries and States
const LOCATIONS = {
    BR: {
        name: "Brasil",
        flag: "https://flagcdn.com/w20/br.png",
        states: [
            "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
        ]
    },
    US: {
        name: "USA",
        flag: "https://flagcdn.com/w20/us.png",
        states: [
            "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
        ]
    }
};

const LeadMap: React.FC<LeadMapProps> = ({ leads, discoveryResults = [], openAiKey, addLead }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  
  // Dropdown Refs
  const dropdownRef = useRef<HTMLDivElement>(null);
  const countryRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);
  
  const [mapType, setMapType] = useState<'street' | 'satellite'>('street');
  const [selectedLead, setSelectedLead] = useState<Partial<Lead> | null>(null);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchIndustry, setSearchIndustry] = useState('');
  const [searchLimit, setSearchLimit] = useState<number | string>(5);
  const [isSearching, setIsSearching] = useState(false);
  const [aiPlaces, setAiPlaces] = useState<Partial<Lead>[]>([]);
  
  // Location Filters
  const [country, setCountry] = useState<'BR' | 'US'>('BR');
  const [region, setRegion] = useState('');

  // Dropdown States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const [isRegionOpen, setIsRegionOpen] = useState(false);

  // Filter leads that have valid coordinates
  const validLeads = leads.filter(l => l.lat !== 0 && l.lng !== 0);
  const allMapPoints = [...validLeads, ...discoveryResults, ...aiPlaces];

  const getMarkerColor = (lead: Partial<Lead>) => {
    // If it's a "Ghost" lead (from AI search or Discovery)
    if (!lead.id) {
        if (aiPlaces.includes(lead)) return '#6b7280'; // Gray for Map Search Results
        return '#94a3b8'; // Slate for Discovery
    }

    switch (lead.status) {
      case PipelineStage.CLOSED: return '#10b981'; // Emerald
      case PipelineStage.NEW: return '#3b82f6'; // Blue
      case PipelineStage.LOST: return '#ef4444'; // Red
      case PipelineStage.QUALIFIED: return '#a855f7'; // Purple
      default: return '#f59e0b'; // Amber
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Initialize Map
    // Default to a central location (e.g. Sao Paulo) if no leads, or the first lead
    const initialLat = validLeads.length > 0 ? validLeads[0].lat : -23.5505;
    const initialLng = validLeads.length > 0 ? validLeads[0].lng : -46.6333;

    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);
    mapInstanceRef.current = map;

    // Add Tiles
    addTileLayer(map, 'street');

    // Force resize calculation after mount
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tiles when mapType changes
  useEffect(() => {
      if (!mapInstanceRef.current) return;
      const L = (window as any).L;
      
      // Remove existing layers
      mapInstanceRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.TileLayer) {
              mapInstanceRef.current.removeLayer(layer);
          }
      });

      addTileLayer(mapInstanceRef.current, mapType);
  }, [mapType]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
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

  // Update Markers when leads or AI results change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    // Clear existing markers
    markersRef.current.forEach(marker => map.removeLayer(marker));
    markersRef.current = [];

    const bounds = L.latLngBounds();

    allMapPoints.forEach(lead => {
        if(!lead.lat || !lead.lng) return;

        const color = getMarkerColor(lead);
        const isGhost = !lead.id; // Not in CRM yet
        
        // Create custom CSS icon
        let iconHtml;
        if (isGhost) {
             iconHtml = `
            <div style="background-color: ${color}90; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 5px rgba(0,0,0,0.3); border: 2px solid white;">
                <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
            </div>
        `;
        } else {
            iconHtml = `
            <div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 2px 2px 5px rgba(0,0,0,0.3); border: 2px solid white;">
                <div style="width: 8px; height: 8px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
            </div>
        `;
        }
        
        const customIcon = L.divIcon({
            className: 'custom-pin',
            html: iconHtml,
            iconSize: isGhost ? [20, 20] : [30, 42],
            iconAnchor: isGhost ? [10, 10] : [15, 42],
            popupAnchor: isGhost ? [0, -10] : [0, -35]
        });

        const hasData = (val: string | null | undefined) => {
            return val && val !== 'null' && val !== 'undefined' && val !== '';
        };

        // HTML Content for Popup (Simplified - No Images, No Mapillary)
        const popupContent = `
            <div style="font-family: 'Inter', sans-serif; min-width: 250px; max-width: 280px;">
                <div style="padding: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                        <h3 style="font-weight: 700; color: #1f2937; font-size: 14px; margin: 0; line-height: 1.2;">${lead.company}</h3>
                        ${isGhost ? '<span style="background: #f3f4f6; color: #6b7280; font-size: 9px; padding: 2px 4px; border-radius: 4px; border: 1px solid #e5e7eb;">Oportunidade</span>' : ''}
                    </div>
                    
                    ${lead.description ? `
                        <p style="font-size: 11px; color: #6b7280; margin-bottom: 8px; font-style: italic; line-height: 1.3;">${lead.description}</p>
                    ` : ''}

                    <p style="font-size: 11px; color: #4b5563; margin-bottom: 6px; display: flex; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        ${hasData(lead.address) ? lead.address : 'Endereço aproximado'}
                    </p>

                    ${lead.openingHours ? `
                        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 6px; color: #4b5563; font-size: 11px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            ${lead.openingHours}
                        </div>
                    ` : ''}
                    
                    ${lead.name && lead.name !== 'Gerente' && hasData(lead.name) ? `
                        <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 4px; color: #4b5563; font-size: 11px;">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <strong>Dono/Contato:</strong> ${lead.name}
                        </div>
                    ` : ''}

                    <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; margin-top: 8px;">
                        ${hasData(lead.phone) ? `
                            <a href="tel:${lead.phone}" style="background: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-decoration: none; display: flex; align-items: center; gap: 2px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                ${lead.phone}
                            </a>
                        ` : `
                            <span style="background: #f3f4f6; color: #9ca3af; padding: 2px 6px; border-radius: 4px; font-size: 10px; display: flex; align-items: center; gap: 2px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                Telefone Indisponível
                            </span>
                        `}
                        ${hasData(lead.website) ? `
                            <a href="${lead.website}" target="_blank" style="background: #eff6ff; color: #2563eb; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-decoration: none; display: flex; align-items: center; gap: 2px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                                Site
                            </a>
                        ` : ''}
                        ${hasData(lead.instagram) ? `
                            <a href="${lead.instagram}" target="_blank" style="background: #fdf2f8; color: #db2777; padding: 2px 6px; border-radius: 4px; font-size: 10px; text-decoration: none; display: flex; align-items: center; gap: 2px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                                Insta
                            </a>
                        ` : ''}
                    </div>

                    ${!isGhost ? `
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6;">
                        <span style="background: ${color}20; color: ${color}; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600;">${lead.status}</span>
                        <span style="font-weight: 700; color: #059669; font-size: 12px;">$ ${(lead.value || 0).toLocaleString()}</span>
                    </div>
                    ` : `
                    <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #f3f4f6;">
                        <button id="btn-import-${lead.company?.replace(/[^a-zA-Z0-9]/g, '')}" style="width: 100%; background: #4f46e5; color: white; border: none; padding: 6px; border-radius: 4px; font-size: 11px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px;">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> 
                        Adicionar ao CRM
                        </button>
                    </div>
                    `}
                </div>
            </div>
        `;

        const marker = L.marker([lead.lat, lead.lng], { icon: customIcon })
            .addTo(map)
            .bindPopup(popupContent);

        marker.on('click', () => {
            setSelectedLead(lead);
            map.flyTo([lead.lat, lead.lng], 16, { duration: 1.5 });
            
            // Hacky way to add event listener to popup button after it opens
            setTimeout(() => {
                // Sanitize ID
                const safeId = lead.company?.replace(/[^a-zA-Z0-9]/g, '');
                const btn = document.getElementById(`btn-import-${safeId}`);
                if (btn && addLead) {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        addLead(lead);
                        marker.closePopup();
                    };
                }
            }, 100);
        });

        markersRef.current.push(marker);
        bounds.extend([lead.lat, lead.lng]);
    });

  }, [leads, discoveryResults, aiPlaces]);

  const addTileLayer = (map: any, type: 'street' | 'satellite') => {
      const L = (window as any).L;
      if (type === 'street') {
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);
      } else {
        // Using Esri World Imagery for Satellite feel
        L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
            maxZoom: 19
        }).addTo(map);
      }
  };

  const centerMap = () => {
      if (mapInstanceRef.current && validLeads.length > 0) {
        const L = (window as any).L;
        const bounds = L.latLngBounds();
        validLeads.forEach(l => bounds.extend([l.lat, l.lng]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      }
  };

  const handleMapSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;

      setIsSearching(true);
      
      try {
          // 1. Geocoding via Nominatim (OpenStreetMap)
          // Construct a more specific query using State and Country
          const countryName = LOCATIONS[country].name;
          const fullQuery = `${searchQuery}, ${region ? region + ',' : ''} ${countryName}`;
          
          const nominatimRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}`);
          const geoData = await nominatimRes.json();

          if (geoData && geoData.length > 0) {
              const { lat, lon, display_name } = geoData[0];
              const latitude = parseFloat(lat);
              const longitude = parseFloat(lon);

              // Fly to location
              if (mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([latitude, longitude], 16, { duration: 2 });
              }

              // 2. Ask AI to find businesses nearby this coordinate
              let newPlaces = [];
              const limit = typeof searchLimit === 'number' ? searchLimit : parseInt(searchLimit) || 5;
              if (openAiKey) {
                   newPlaces = await findNearbyPlacesWithOpenAI(latitude, longitude, display_name, openAiKey, searchIndustry, limit);
              } else {
                   newPlaces = await findNearbyPlaces(latitude, longitude, display_name, searchIndustry, limit);
              }
              
              setAiPlaces(newPlaces);
              
              // 3. AUTO FIT BOUNDS to show all new pins
              if (newPlaces.length > 0 && mapInstanceRef.current) {
                  const L = (window as any).L;
                  const bounds = L.latLngBounds();
                  
                  // Add center point
                  bounds.extend([latitude, longitude]);
                  
                  // Add all found places
                  newPlaces.forEach(p => {
                      if (p.lat && p.lng) bounds.extend([p.lat, p.lng]);
                  });
                  
                  // Delay slightly to allow map to finish flying to center first, or interrupt it
                  setTimeout(() => {
                    mapInstanceRef.current.fitBounds(bounds, { padding: [80, 80], maxZoom: 17, animate: true, duration: 1.5 });
                  }, 500);
              }

          } else {
              alert("Local não encontrado. Tente ser mais específico.");
          }

      } catch (error) {
          if (error instanceof Error) {
              alert(`Erro: ${error.message}`);
          } else {
              console.error("Map search error", error);
          }
      } finally {
          setIsSearching(false);
      }
  };

  // Limit Input Handlers
  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (val === '') {
          setSearchLimit('');
          return;
      }
      const num = parseInt(val);
      if (!isNaN(num) && num <= 20) {
          setSearchLimit(num);
      }
  };

  const handleLimitBlur = () => {
      if (searchLimit === '' || Number(searchLimit) < 1) {
          setSearchLimit(5);
      }
  };

  return (
    <div className="h-full flex flex-col space-y-4 relative">
       <div className="flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <MapPin className="w-6 h-6 text-indigo-600" />
                Mapa de Oportunidades
            </h2>
            <p className="text-gray-500 text-sm">Visualização geoespacial dos leads e territórios.</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setMapType(mapType === 'street' ? 'satellite' : 'street')}
                className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm flex items-center gap-2 transition-all"
            >
                <Layers className="w-4 h-4" />
                {mapType === 'street' ? 'Modo Satélite (3D)' : 'Modo Rua'}
            </button>
            <button 
                onClick={centerMap}
                className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm flex items-center gap-2 transition-all"
            >
                <Maximize2 className="w-4 h-4" />
                Centralizar
            </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 h-full min-h-[500px] relative">
          
          {/* Smart Search Bar Overlay - Centered */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] w-full max-w-5xl flex flex-col gap-2 px-4">
              <form onSubmit={handleMapSearch} className="flex flex-wrap md:flex-nowrap gap-2 p-2 bg-white/95 backdrop-blur rounded-xl shadow-lg border border-gray-200 items-center">
                  
                   {/* Country Selector */}
                   <div className="relative w-24 shrink-0" ref={countryRef}>
                        <button
                            type="button"
                            onClick={() => setIsCountryOpen(!isCountryOpen)}
                            className="w-full px-2 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none flex items-center justify-between"
                        >
                             <div className="flex items-center gap-1.5">
                                <img src={LOCATIONS[country].flag} alt={country} className="w-4 h-auto rounded-sm" />
                                <span className="text-xs font-bold">{country}</span>
                            </div>
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                        {isCountryOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
                                {Object.entries(LOCATIONS).map(([code, data]) => (
                                    <div
                                        key={code}
                                        onClick={() => { setCountry(code as 'BR' | 'US'); setIsCountryOpen(false); setRegion(''); }}
                                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                                    >
                                        <img src={data.flag} alt={code} className="w-4 h-auto rounded-sm" />
                                        <span className="text-xs font-bold">{code}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                   </div>

                   {/* State Selector */}
                   <div className="relative w-28 shrink-0" ref={regionRef}>
                        <button
                            type="button"
                            onClick={() => setIsRegionOpen(!isRegionOpen)}
                            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 flex justify-between items-center hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                        >
                            <span className="truncate text-xs">{region || "Estado"}</span>
                            <ChevronDown className="w-3 h-3 text-gray-400" />
                        </button>
                         {isRegionOpen && (
                            <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                <div onClick={() => { setRegion(''); setIsRegionOpen(false); }} className="px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer text-gray-500 italic">Todos</div>
                                {LOCATIONS[country].states.map(s => (
                                    <div key={s} onClick={() => { setRegion(s); setIsRegionOpen(false); }} className={`px-3 py-2 text-xs hover:bg-indigo-50 cursor-pointer ${region === s ? 'text-indigo-600 font-bold' : 'text-gray-700'}`}>
                                        {s}
                                    </div>
                                ))}
                            </div>
                        )}
                   </div>

                  <div className="relative flex-1 min-w-[200px]">
                    <input 
                        type="text" 
                        placeholder="Buscar local (ex: Av. Paulista, Restaurantes...)" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  
                  {/* Custom Industry Dropdown */}
                  <div className="relative w-48 shrink-0 hidden md:block" ref={dropdownRef}>
                      <button
                          type="button"
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 flex justify-between items-center hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                      >
                          <span className="truncate text-xs">{searchIndustry || "Todas Indústrias"}</span>
                          <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isDropdownOpen && (
                          <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-60 overflow-y-auto custom-scrollbar">
                              <button
                                  type="button"
                                  onClick={() => { setSearchIndustry(''); setIsDropdownOpen(false); }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between ${searchIndustry === '' ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                              >
                                  Todas Indústrias
                                  {searchIndustry === '' && <Check className="w-3 h-3" />}
                              </button>
                              {INDUSTRIES.map(ind => (
                                  <button
                                      key={ind}
                                      type="button"
                                      onClick={() => { setSearchIndustry(ind); setIsDropdownOpen(false); }}
                                      className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-50 flex items-center justify-between ${searchIndustry === ind ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                                  >
                                      {ind}
                                      {searchIndustry === ind && <Check className="w-3 h-3" />}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>

                  {/* Limit Input */}
                   <div className="relative w-20 shrink-0 hidden sm:block">
                      <input 
                          type="number" 
                          value={searchLimit}
                          onChange={handleLimitChange}
                          onBlur={handleLimitBlur}
                          className="w-full pl-8 pr-2 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-white appearance-none"
                          title="Máximo de leads (Max 20)"
                          placeholder="Qtd"
                      />
                       <ListOrdered className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>

                  <button 
                        type="submit" 
                        disabled={isSearching}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium text-sm flex items-center gap-2 shrink-0"
                    >
                        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
                    </button>
              </form>

              {aiPlaces.length > 0 && (
                  <div className="bg-white/90 backdrop-blur rounded-lg p-2 shadow-lg border border-gray-100 text-xs text-center animate-in fade-in slide-in-from-top-2 mx-auto flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <p className="text-gray-600">Encontrei <span className="font-bold text-indigo-600">{aiPlaces.length}</span> locais próximos!</p>
                  </div>
              )}
          </div>

          {/* Map Container */}
          <div className="flex-1 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden relative z-0">
             <div ref={mapContainerRef} className="w-full h-full" style={{ zIndex: 1 }} />
             
             {/* Legend Overlay */}
             <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-xl shadow-lg border border-gray-100 z-[400] text-xs">
                <h4 className="font-bold text-gray-700 mb-2">Legenda</h4>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500 block shadow-sm border border-white"></span>
                        <span className="text-gray-600">Novo Lead</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-amber-500 block shadow-sm border border-white"></span>
                        <span className="text-gray-600">Em Negociação</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-500 block shadow-sm border border-white"></span>
                        <span className="text-gray-600">Fechado</span>
                    </div>
                     <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-400 block shadow-sm border border-white"></span>
                        <span className="text-gray-500 italic">Oportunidade (Busca)</span>
                    </div>
                </div>
             </div>
          </div>

          {/* Sidebar List Overlay (Desktop) */}
          <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col overflow-hidden hidden lg:flex">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-bold text-gray-700">Leads no Mapa ({validLeads.length})</h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {validLeads.map(lead => (
                      <div 
                        key={lead.id}
                        onClick={() => {
                            setSelectedLead(lead);
                            if (mapInstanceRef.current) {
                                mapInstanceRef.current.flyTo([lead.lat, lead.lng], 17, { duration: 1.5 });
                            }
                        }}
                        className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                            selectedLead?.id === lead.id 
                            ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300' 
                            : 'bg-white border-gray-100 hover:border-indigo-200'
                        }`}
                      >
                          <div className="flex justify-between items-start mb-1">
                              <h4 className="font-bold text-sm text-gray-800 truncate pr-2">{lead.company}</h4>
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                                  {lead.status.split(' ')[0]}
                              </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                              <MapPin className="w-3 h-3" /> {lead.city}
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                              <span className="text-xs font-bold text-emerald-600">$ {lead.value?.toLocaleString()}</span>
                              {lead.contactRole && (
                                  <span className="text-[10px] text-indigo-600 flex items-center gap-1">
                                      <User className="w-3 h-3" /> {lead.contactRole}
                                  </span>
                              )}
                          </div>
                      </div>
                  ))}
                  {validLeads.length === 0 && (
                      <div className="p-4 text-center text-gray-400 text-xs">
                          Nenhum lead com localização válida.
                      </div>
                  )}
              </div>
          </div>
      </div>
    </div>
  );
};

export default LeadMap;
