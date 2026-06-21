import { useState, useEffect, useRef } from 'react';
import { 
  Sun, Home, Building2, Trees, TreePine, 
  Smartphone, Tv, Snowflake, Info, 
  MapPin, Search, Send, Sparkles, Key, X, Flame, Fuel, Car
} from 'lucide-react';
import { TRANSLATIONS } from './utils/i18n';

// Options for panels
const PANEL_TYPES = {
  small: {
    id: 'small',
    power: 300,
    icon: Home,
  },
  medium: {
    id: 'medium',
    power: 450,
    icon: Home,
  },
  large: {
    id: 'large',
    power: 550,
    icon: Building2,
  }
};

const LANGUAGES = [
  { code: 'ru', label: '🇷🇺 RU' },
  { code: 'en', label: '🇬🇧 EN' },
  { code: 'es', label: '🇪🇸 ES' },
  { code: 'de', label: '🇩🇪 DE' },
  { code: 'zh', label: '🇨🇳 ZH' }
];

export default function App() {
  const [lang, setLang] = useState('ru');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedPanel, setSelectedPanel] = useState('medium');
  const [panelCount, setPanelCount] = useState(12);
  const [coords, setCoords] = useState({ lat: 41.31, lng: 69.24 }); // Tashkent default
  const [locationName, setLocationName] = useState('Ташкент, Узбекистан');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Insolation dynamically estimated
  const [insolation, setInsolation] = useState(1600);
  
  // Gemini Assistant State
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('solarify_gemini_key') || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const t = TRANSLATIONS[lang] || TRANSLATIONS['ru'];

  const [chatMessages, setChatMessages] = useState([
    { 
      role: 'assistant', 
      content: t.botGreeting 
    }
  ]);

  // Map refs
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapContainerRef = useRef(null);

  // Update chatbot greeting on language change
  useEffect(() => {
    setChatMessages([
      { 
        role: 'assistant', 
        content: t.botGreeting 
      }
    ]);
  }, [lang]);

  // Calculate coordinates-based solar insolation dynamically
  useEffect(() => {
    const latDiff = Math.abs(coords.lat - 41.31);
    const baseVal = 1600;
    const factor = Math.max(0.4, Math.min(1.4, 1.25 - (latDiff * 0.018)));
    setInsolation(Math.round(baseVal * factor));
  }, [coords]);

  // Leaflet Map Initialization
  useEffect(() => {
    if (!window.L || !mapContainerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = window.L.map(mapContainerRef.current, {
        center: [coords.lat, coords.lng],
        zoom: 10,
        zoomControl: true
      });

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapRef.current);

      const sunIcon = window.L.divIcon({
        className: 'custom-sun-marker',
        html: `<div class="w-8 h-8 bg-amber-400 border-4 border-white rounded-full flex items-center justify-center shadow-lg animate-pulse">
                <span class="text-xs">☀️</span>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      markerRef.current = window.L.marker([coords.lat, coords.lng], {
        icon: sunIcon,
        draggable: true
      }).addTo(mapRef.current);

      mapRef.current.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        updateLocation(lat, lng);
      });

      markerRef.current.on('dragend', () => {
        const position = markerRef.current.getLatLng();
        updateLocation(position.lat, position.lng);
      });
    }
  }, [activeTab]); // Redraw/re-init map if tab changes to dashboard

  // Update marker position and reverse geocode
  const updateLocation = async (lat, lng) => {
    const newLat = parseFloat(lat.toFixed(4));
    const newLng = parseFloat(lng.toFixed(4));
    setCoords({ lat: newLat, lng: newLng });

    if (markerRef.current) {
      markerRef.current.setLatLng([newLat, newLng]);
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLat}&lon=${newLng}&accept-language=${lang}`);
      const data = await response.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        const shortName = parts.slice(0, 3).join(',').trim();
        setLocationName(shortName);
      } else {
        setLocationName(`${newLat}, ${newLng}`);
      }
    } catch (error) {
      setLocationName(`${newLat}, ${newLng}`);
    }
  };

  // Search Address
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&accept-language=${lang}`);
      const data = await response.json();
      if (data && data.length > 0) {
        const first = data[0];
        const lat = parseFloat(first.lat);
        const lng = parseFloat(first.lon);
        
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 11);
        }
        updateLocation(lat, lng);
      } else {
        alert(t.notFound);
      }
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  // Calculations
  const panelPower = PANEL_TYPES[selectedPanel].power;
  const systemCapacityKW = (panelCount * panelPower) / 1000;
  const annualGenerationKWh = Math.round(systemCapacityKW * insolation * 0.82);

  // Friendly equivalents
  const fridgeMonths = Math.round((annualGenerationKWh / 30) * 10) / 10;
  const phoneCharges = Math.round(annualGenerationKWh / 0.015);
  const tvHours = Math.round(annualGenerationKWh / 0.1);

  // Eco variables
  const co2SavedKg = Math.round(annualGenerationKWh * 0.52);
  const treesSaved = Math.round(co2SavedKg / 22);

  // Extended eco stats for kids
  const coalSavedKg = Math.round(annualGenerationKWh * 0.4); // 0.4kg of coal per kWh
  const petrolSavedLiters = Math.round(annualGenerationKWh * 0.15); // 0.15L saved per kWh
  const carKmSaved = Math.round(annualGenerationKWh * 3); // 3 km driving equivalent

  // Save API Key
  const handleSaveApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem('solarify_gemini_key', key);
    setShowKeyInput(false);
  };

  // Bot local answers
  const getLocalAnswer = (question) => {
    const q = question.toLowerCase();
    if (q.includes('мыть') || q.includes('clean') || q.includes('wash') || q.includes('limpiar') || q.includes('reinigen') || q.includes('清洗')) {
      return t.localWashAnswer;
    }
    if (q.includes('дожд') || q.includes('rain') || q.includes('lluvia') || q.includes('regen') || q.includes('下雨')) {
      return t.localRainAnswer;
    }
    if (q.includes('дерев') || q.includes('спас') || q.includes('tree') || q.includes('árbol') || q.includes('baum') || q.includes('树')) {
      return t.localTreesAnswer.replace('{count}', treesSaved);
    }
    return t.localFallbackAnswer;
  };

  // AI Chat query using Gemini API
  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputText;
    if (!text.trim()) return;

    const newMessages = [...chatMessages, { role: 'user', content: text }];
    setChatMessages(newMessages);
    setInputText('');
    setIsAiLoading(true);

    if (!apiKey) {
      setTimeout(() => {
        setChatMessages(prev => [...prev, { role: 'assistant', content: getLocalAnswer(text) }]);
        setIsAiLoading(false);
      }, 600);
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: `Системная инструкция: Ты — добрый и забавный помощник "Солнышко", говоришь только о солнечной энергии простыми словами для детей и мам. Если спрашивают не про солнце или экологию — вежливо отказывай. Всегда пиши на выбранном языке: ${lang.toUpperCase()}. Используй много эмодзи ☀️, 🔋, 🌳 в каждом предложении.
                    
                    Текущий диалог:
                    ${newMessages.map(m => `${m.role === 'user' ? 'Пользователь' : 'Помощник'}: ${m.content}`).join('\n')}
                    
                    Ответь на последнее сообщение в соответствии с инструкцией.`
                  }
                ]
              }
            ],
            generationConfig: {
              maxOutputTokens: 300,
              temperature: 0.7
            }
          })
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        const reply = data.candidates[0].content.parts[0].text;
        setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', content: t.botError }]);
      }
    } catch (error) {
      console.error('API Error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: t.botConnError }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-amber-50 via-emerald-50 to-amber-100 text-gray-700">
      
      {/* Header */}
      <header className="py-6 px-4 md:px-8 max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-400 rounded-2xl flex items-center justify-center shadow-md animate-bounce-slow shrink-0">
            <Sun className="w-8 h-8 text-white fill-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-amber-500">
              {t.title}
            </h1>
            <p className="text-xs font-semibold text-emerald-600 font-heading">
              {t.subtitle}
            </p>
            <p className="text-[10px] font-bold text-amber-600 font-heading mt-0.5 opacity-90">
              ❤️ {t.madeWithCare}
            </p>
          </div>
        </div>

        {/* Control area: Language switcher & API settings */}
        <div className="flex items-center gap-3">
          {/* PRO Version Link */}
          <a 
            href="./EcoHelioPulse_Pro.html"
            className="px-4 py-2 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            {t.proVersion}
          </a>

          {/* Language selection dropdown */}
          <select 
            value={lang} 
            onChange={(e) => setLang(e.target.value)}
            className="px-3 py-2 bg-white border border-amber-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer shadow-xs"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>{l.label}</option>
            ))}
          </select>

          {/* AI Settings badge */}
          <button 
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white border border-amber-200 text-sm font-medium hover:bg-amber-100 transition shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">
              {apiKey ? t.apiKeyConnected : t.settingsAi}
            </span>
          </button>
        </div>
      </header>

      {/* API Key Modal */}
      {showKeyInput && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border-4 border-amber-300">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-heading text-lg font-bold text-amber-600 flex items-center gap-2">
                <Sparkles className="w-5 h-5" /> {t.apiModalTitle}
              </h3>
              <button onClick={() => setShowKeyInput(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              {t.apiModalDesc}
            </p>
            <input 
              type="password"
              placeholder={t.apiKeyPlaceholder}
              defaultValue={apiKey}
              id="gemini-key-input"
              className="w-full px-4 py-3 rounded-2xl border-2 border-amber-200 focus:outline-none focus:border-amber-400 mb-4 text-sm font-mono"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const val = document.getElementById('gemini-key-input').value;
                  handleSaveApiKey(val);
                }}
                className="flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-2xl text-sm transition shadow-md cursor-pointer"
              >
                {t.save}
              </button>
              {apiKey && (
                <button 
                  onClick={() => handleSaveApiKey('')}
                  className="px-4 py-3 bg-rose-100 hover:bg-rose-200 text-rose-600 font-bold rounded-2xl text-sm transition cursor-pointer"
                >
                  {t.delete}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs navigation */}
      <nav className="max-w-6xl mx-auto px-4 md:px-8 mb-8 flex justify-center gap-2">
        <div className="bg-white/80 p-1.5 rounded-2xl border border-amber-200/50 shadow-md flex gap-1">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`px-6 py-2.5 rounded-xl font-heading text-sm font-bold transition cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-amber-400 text-white shadow-sm' : 'text-gray-500 hover:bg-amber-50'
            }`}
          >
            {t.tabDashboard}
          </button>
          <button 
            onClick={() => setActiveTab('forest')}
            className={`px-6 py-2.5 rounded-xl font-heading text-sm font-bold transition cursor-pointer ${
              activeTab === 'forest' ? 'bg-emerald-500 text-white shadow-sm' : 'text-gray-500 hover:bg-emerald-50'
            }`}
          >
            {t.tabForest}
          </button>
          <button 
            onClick={() => setActiveTab('edu')}
            className={`px-6 py-2.5 rounded-xl font-heading text-sm font-bold transition cursor-pointer ${
              activeTab === 'edu' ? 'bg-sky-500 text-white shadow-sm' : 'text-gray-500 hover:bg-sky-50'
            }`}
          >
            {t.tabEdu}
          </button>
        </div>
      </nav>

      {/* Main Grid Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-8">
        
        {/* Tab 1: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Map and settings */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* GIS Map */}
              <div className="bg-white rounded-3xl p-6 shadow-xl border border-amber-200/50">
                <h2 className="font-heading text-lg font-bold text-amber-500 flex items-center gap-2 mb-4">
                  <MapPin className="w-5 h-5 text-emerald-500" /> {t.step1Title}
                </h2>
                
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      placeholder={t.searchPlaceholder}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-amber-50/50 border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                    />
                    <Search className="w-4 h-4 text-amber-400 absolute left-3.5 top-3.5" />
                  </div>
                  <button 
                    type="submit"
                    className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-2xl text-sm transition shadow-sm cursor-pointer shrink-0"
                  >
                    {t.searchBtn}
                  </button>
                </form>

                <div ref={mapContainerRef} className="h-64 w-full rounded-2xl mb-3 relative z-10"></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-500 bg-amber-50/60 p-3 rounded-xl border border-amber-100 gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-amber-600">{t.latitude}:</span> {coords.lat}
                    <span className="font-semibold text-amber-600 ml-2">{t.longitude}:</span> {coords.lng}
                  </div>
                  <div className="font-medium text-emerald-600 truncate max-w-[90%]">
                    📍 {locationName}
                  </div>
                </div>
              </div>

              {/* Panel calculation */}
              <div className="bg-white rounded-3xl p-6 shadow-xl border border-amber-200/50">
                <h2 className="font-heading text-lg font-bold text-amber-500 flex items-center gap-2 mb-4">
                  <Sun className="w-5 h-5 text-amber-500" /> {t.step2Title}
                </h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  {/* Small panel */}
                  <button
                    onClick={() => setSelectedPanel('small')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer ${
                      selectedPanel === 'small' 
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-md transform scale-102 font-bold' 
                        : 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      selectedPanel === 'small' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Home className="w-6 h-6" />
                    </div>
                    <span className="font-heading font-bold text-sm block mb-1">{t.panelSmall}</span>
                    <span className="text-xs font-semibold text-emerald-600 block mb-2">{PANEL_TYPES.small.power} {t.panelUnit === '块' ? '瓦' : 'W'}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{t.panelSmallDesc}</span>
                  </button>

                  {/* Medium panel */}
                  <button
                    onClick={() => setSelectedPanel('medium')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer ${
                      selectedPanel === 'medium' 
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-md transform scale-102 font-bold' 
                        : 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      selectedPanel === 'medium' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Home className="w-8 h-8" />
                    </div>
                    <span className="font-heading font-bold text-sm block mb-1">{t.panelMedium}</span>
                    <span className="text-xs font-semibold text-emerald-600 block mb-2">{PANEL_TYPES.medium.power} {t.panelUnit === '块' ? '瓦' : 'W'}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{t.panelMediumDesc}</span>
                  </button>

                  {/* Large panel */}
                  <button
                    onClick={() => setSelectedPanel('large')}
                    className={`p-4 rounded-2xl border-2 flex flex-col items-center text-center transition cursor-pointer ${
                      selectedPanel === 'large' 
                        ? 'border-emerald-500 bg-emerald-50/80 shadow-md transform scale-102 font-bold' 
                        : 'border-amber-100 bg-amber-50/20 hover:bg-amber-50/50'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${
                      selectedPanel === 'large' ? 'bg-emerald-500 text-white shadow-sm' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <span className="font-heading font-bold text-sm block mb-1">{t.panelLarge}</span>
                    <span className="text-xs font-semibold text-emerald-600 block mb-2">{PANEL_TYPES.large.power} {t.panelUnit === '块' ? '瓦' : 'W'}</span>
                    <span className="text-[10px] text-gray-400 leading-tight">{t.panelLargeDesc}</span>
                  </button>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-500">{t.panelQuantity}</span>
                    <span className="text-xl font-heading font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-xl">
                      {panelCount} {t.panelUnit}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="1"
                    max="100"
                    value={panelCount}
                    onChange={(e) => setPanelCount(parseInt(e.target.value))}
                    className="w-full h-3 bg-amber-100 rounded-lg appearance-none cursor-pointer accent-emerald-500 mb-2 focus:outline-none"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 font-semibold">
                    <span>1</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Simple results */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              <div className="bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-[-40px] top-[-40px] opacity-10 pointer-events-none">
                  <Sun className="w-48 h-48 animate-spin-slow" />
                </div>

                <div className="relative z-10">
                  <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider">
                    {t.resultsTitle}
                  </span>
                  
                  <div className="mt-4 mb-6">
                    <span className="text-5xl font-heading font-extrabold">{annualGenerationKWh}</span>
                    <span className="text-lg font-bold ml-1">{t.annualGen}</span>
                    <p className="text-xs text-amber-50 mt-1 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" />
                      {t.insolationInfo} {insolation} {t.panelUnit === '块' ? '千瓦时/平米' : 'kWh/m²'}
                    </p>
                  </div>

                  <h3 className="font-heading font-bold text-sm mb-4 border-b border-white/20 pb-2">
                    {t.enoughFor}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-xs">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <Snowflake className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-amber-50">{t.fridgeTitle}</p>
                        <p className="font-heading font-bold text-sm">{fridgeMonths} {t.fridgeVal}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-xs">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <Tv className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-amber-50">{t.tvTitle}</p>
                        <p className="font-heading font-bold text-sm">{tvHours.toLocaleString(lang)} {t.tvVal}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-xs">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <Smartphone className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-amber-50">{t.phoneTitle}</p>
                        <p className="font-heading font-bold text-sm">{phoneCharges.toLocaleString(lang)} {t.phoneVal}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Quick info card */}
              <div className="bg-white rounded-3xl p-6 shadow-xl border border-amber-200/30 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-2xl shrink-0">
                  💡
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">
                  {t.infoCardText}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Forest */}
        {activeTab === 'forest' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Visual Forest Block */}
            <div className="lg:col-span-7 bg-white rounded-3xl p-6 shadow-xl border border-emerald-100">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-heading text-lg font-bold text-emerald-600 flex items-center gap-2">
                    <Trees className="w-5 h-5 text-emerald-500" /> {t.forestLabel}
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">{t.forestDesc}</p>
                </div>
                <span className="text-4xl">🌲</span>
              </div>

              {/* Visual forest rendering */}
              <div className="bg-gradient-to-b from-emerald-50 to-emerald-100/50 rounded-2xl p-6 min-h-[300px] border border-emerald-100 flex flex-wrap gap-3 justify-center items-center relative">
                {Array.from({ length: Math.min(60, treesSaved) }).map((_, i) => (
                  <div 
                    key={i} 
                    className="tree-animation shrink-0 hover:scale-130 transition duration-200 cursor-pointer"
                    title="Ура, спасенное дерево!"
                    style={{ animationDelay: `${Math.min(1.5, i * 0.02)}s` }}
                  >
                    {i % 3 === 0 ? (
                      <TreePine className="w-10 h-10 text-emerald-600 drop-shadow-sm" />
                    ) : i % 3 === 1 ? (
                      <Trees className="w-10 h-10 text-emerald-500 drop-shadow-sm" />
                    ) : (
                      <span className="text-3xl filter drop-shadow-sm">🌳</span>
                    )}
                  </div>
                ))}
                
                {treesSaved === 0 && (
                  <div className="text-sm text-gray-400 text-center py-16">
                    {t.emptyForest}
                  </div>
                )}

                {treesSaved > 60 && (
                  <div className="w-full text-center mt-4">
                    <span className="inline-block text-xs font-bold text-emerald-700 bg-white border border-emerald-200 px-3 py-1.5 rounded-xl shadow-xs">
                      {t.additionalTrees.replace('{count}', treesSaved - 60)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Eco Comparisons */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Eco stats summary */}
              <div className="bg-white rounded-3xl p-6 shadow-xl border border-emerald-200/50">
                <h3 className="font-heading text-lg font-bold text-emerald-600 mb-4">
                  {t.ecoTitle}
                </h3>

                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 mb-6 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-emerald-700 font-semibold block">{t.ecoDesc}</span>
                    <span className="text-2xl font-heading font-extrabold text-emerald-700">-{co2SavedKg} кг / год</span>
                  </div>
                  <span className="text-3xl">🌱</span>
                </div>

                <h4 className="font-heading font-bold text-sm text-gray-500 mb-3 uppercase tracking-wider">
                  {t.compareTitle}
                </h4>

                <div className="space-y-4">
                  {/* Coal saved */}
                  <div className="flex gap-4 p-3 bg-amber-50/40 rounded-2xl border border-amber-100">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
                      <Flame className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-600">{t.coalSaved}</p>
                      <p className="text-sm font-heading font-bold text-amber-700">~{coalSavedKg} {t.panelUnit === '块' ? '公斤' : 'кг'}</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.coalSavedDesc}</p>
                    </div>
                  </div>

                  {/* Petrol saved */}
                  <div className="flex gap-4 p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
                      <Fuel className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-600">{t.petrolSaved}</p>
                      <p className="text-sm font-heading font-bold text-emerald-700">~{petrolSavedLiters} {t.panelUnit === '块' ? '升' : 'л'}</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.petrolSavedDesc}</p>
                    </div>
                  </div>

                  {/* Car offset */}
                  <div className="flex gap-4 p-3 bg-sky-50/40 rounded-2xl border border-sky-100">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center shrink-0 text-xl">
                      <Car className="w-5 h-5 text-sky-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-600">{t.carOffset}</p>
                      <p className="text-sm font-heading font-bold text-sky-700">~{carKmSaved} {t.panelUnit === '块' ? '公里' : 'км'}</p>
                      <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{t.carOffsetDesc}</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Edu */}
        {activeTab === 'edu' && (
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-sky-100 max-w-4xl mx-auto">
            <h2 className="font-heading text-xl md:text-2xl font-bold text-sky-600 text-center mb-4">
              {t.eduTitle}
            </h2>
            <p className="text-sm text-gray-500 text-center max-w-2xl mx-auto mb-8 leading-relaxed">
              {t.eduIntro}
            </p>

            {/* 4 Interactive steps with cute drawings/illustrations */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              {/* Step 1 */}
              <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-amber-400 rounded-full flex items-center justify-center text-3xl shadow-md sun-float mb-4">
                  ☀️
                </div>
                <h4 className="font-heading font-bold text-xs text-amber-600 mb-2">{t.eduStep1}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t.eduStep1Desc}</p>
              </div>

              {/* Step 2 */}
              <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-400 rounded-2xl flex items-center justify-center text-3xl shadow-md mb-4">
                  🔋
                </div>
                <h4 className="font-heading font-bold text-xs text-emerald-600 mb-2">{t.eduStep2}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t.eduStep2Desc}</p>
              </div>

              {/* Step 3 */}
              <div className="bg-purple-50/60 p-5 rounded-2xl border border-purple-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-purple-400 rounded-2xl flex items-center justify-center text-3xl shadow-md mb-4">
                  ⚡
                </div>
                <h4 className="font-heading font-bold text-xs text-purple-600 mb-2">{t.eduStep3}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t.eduStep3Desc}</p>
              </div>

              {/* Step 4 */}
              <div className="bg-sky-50/60 p-5 rounded-2xl border border-sky-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-sky-400 rounded-2xl flex items-center justify-center text-3xl shadow-md mb-4">
                  🏡
                </div>
                <h4 className="font-heading font-bold text-xs text-sky-600 mb-2">{t.eduStep4}</h4>
                <p className="text-[11px] text-gray-500 leading-relaxed">{t.eduStep4Desc}</p>
              </div>
            </div>

            {/* Compare section */}
            <div className="border-t border-sky-100 pt-8">
              <h3 className="font-heading text-lg font-bold text-center text-gray-700 mb-6">
                {t.eduCompareHeading}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coal compare info */}
                <div className="flex gap-4 bg-amber-50/30 p-5 rounded-2xl border border-amber-100/50">
                  <span className="text-4xl">🚂</span>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-amber-600 mb-1">{t.eduCoalTitle}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{t.eduCoalDesc}</p>
                  </div>
                </div>

                {/* Car compare info */}
                <div className="flex gap-4 bg-emerald-50/30 p-5 rounded-2xl border border-emerald-100/50">
                  <span className="text-4xl">🚗</span>
                  <div>
                    <h4 className="font-heading font-bold text-sm text-emerald-600 mb-1">{t.eduCarTitle}</h4>
                    <p className="text-xs text-gray-500 leading-relaxed">{t.eduCarDesc}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Floating chatbot widget */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {isChatOpen && (
          <div className="bg-white rounded-3xl shadow-2xl border-4 border-amber-300 w-[340px] sm:w-[380px] max-h-[500px] flex flex-col overflow-hidden mb-4 animate-tree-grow">
            
            {/* Chat header */}
            <div className="bg-amber-400 p-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-xl shadow-inner sun-float">
                  ☀️
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm">{t.botName}</h3>
                  <p className="text-[9px] text-amber-50">{t.botSubtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowKeyInput(true)} 
                  className="p-1.5 bg-amber-500 hover:bg-amber-600 rounded-lg text-white transition cursor-pointer"
                  title="Настроить Gemini API ключ"
                >
                  <Key className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setIsChatOpen(false)}
                  className="p-1.5 hover:bg-amber-500 rounded-lg transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages list */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-amber-50/20 max-h-[300px]">
              {chatMessages.map((msg, i) => (
                <div 
                  key={i} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500 text-white rounded-br-none' 
                      : 'bg-white text-gray-700 border border-amber-100 rounded-bl-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className="flex justify-start">
                  <div className="bg-white rounded-2xl rounded-bl-none border border-amber-100 px-4 py-2.5 text-xs text-gray-400 flex items-center gap-1.5 shadow-sm">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span>{t.botThinking}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick action buttons */}
            <div className="px-4 py-2 border-t border-amber-100 bg-amber-50/40 flex flex-wrap gap-1.5">
              <button 
                onClick={() => handleSendMessage(t.qWash)}
                className="text-[10px] bg-white border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg font-medium text-amber-700 transition cursor-pointer"
              >
                {t.qWash}
              </button>
              <button 
                onClick={() => handleSendMessage(t.qRain)}
                className="text-[10px] bg-white border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg font-medium text-amber-700 transition cursor-pointer"
              >
                {t.qRain}
              </button>
              <button 
                onClick={() => handleSendMessage(t.qTrees)}
                className="text-[10px] bg-white border border-amber-200 hover:bg-amber-50 px-2 py-1 rounded-lg font-medium text-amber-700 transition cursor-pointer"
              >
                {t.qTrees}
              </button>
            </div>

            {/* Input footer */}
            <div className="p-3 border-t border-amber-100 bg-white flex gap-2">
              <input 
                type="text"
                placeholder="Спроси о солнце..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                className="flex-1 px-3 py-2 bg-amber-50/30 border border-amber-200 rounded-xl text-xs focus:outline-none focus:border-amber-400"
              />
              <button 
                onClick={() => handleSendMessage()}
                className="w-9 h-9 bg-amber-400 hover:bg-amber-500 rounded-xl flex items-center justify-center text-white transition shrink-0 shadow-sm cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

          </div>
        )}

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className="w-16 h-16 bg-amber-400 hover:bg-amber-500 rounded-full flex items-center justify-center shadow-2xl text-3xl pulse-button-ring select-none text-white font-bold transition transform hover:scale-105 active:scale-95 cursor-pointer relative"
        >
          <span className="sun-float">☀️</span>
          {!isChatOpen && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full border-2 border-white uppercase tracking-wider shadow-sm">
              ИИ
            </span>
          )}
        </button>
      </div>

    </div>
  );
}
