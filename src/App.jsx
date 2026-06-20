import { useState, useEffect, useRef } from 'react';
import { 
  Sun, FileText, MessageSquare, 
  RefreshCw, Leaf, Car, Trees, Flame, Eye, Download, HelpCircle, Key, MapPin
} from 'lucide-react';
import { runSolarEngine } from './utils/solarEngine';
import { TRANSLATIONS } from './utils/i18n';

function App() {
  // Onboarding level state: 'beginner', 'intermediate', 'expert'
  const [userLevel] = useState('expert');
  const [lang, setLang] = useState('ru');
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Parameter inputs
  const [inputs, setInputs] = useState({
    dni: 820,
    dhi: 140,
    zenithAngle: 30,
    tAmbient: 28,
    tNoct: 45,
    isRoofMounted: true,
    pSTC: 440,
    panelType: 'HJT',
    pitchAngle: 35,
    orientation: 'South',
    tLowest: -18,
    vOc: 50.4,
    iSc: 13.5,
    gammaVoc: -0.26,
    vInverterLimit: 1000,
    panelsPerString: 18,
    obstacleHeight: 3.5,
    latitude: 45,
    isBifacial: true,
    albedoType: 'Concrete',
    daysSinceCleaning: 45,
    soilingLossMax: 12,
    soilingFactorK: 0.04,
    hasBlockingDiodes: false,
    fuseType: 'DC Fuse',
    cablesInConduit: 4,
    wireLength: 22,
    wireMaterial: 'Copper',
    wireArea: 6,
    baseCurrentCapacity: 40,
    hasSPD: true,
    spdType: 'Type 2',
    groundingLength: 40,
    rcdType: 'Type B',
    upstreamRcdType: 'Type B',
    inverterRating: 15,
    mpptType: 'MPPT',
    windSpeed: 28,
    panelArea: 42,
    criticalLoad: 18,
    batteryType: 'LiFePO4',
    daysOfAutonomy: 2,
    batteryCapacity: 150,
    batteryVoltage: 48,
    bmsType: 'Active',
    batterySOC: 18,
    hasV2H: true,
    hasDryContact: true,
    zeroExportEnabled: true,
    loadPower: 5.5,
    gridTarget: 0.2,
    hasHeatPump: true,
    lidFactor: 1.5,
    annualDegradation: 0.4,
    operationYears: 25,
    eDirectYearly: 5400,
    eExportYearly: 2100,
    tariffRetail: 0.18,
    tariffFeedIn: 0.06,
    opexYearly: 150,
    inflationRate: 4.5,
    gridEmissionFactor: 0.52,
    occupantsCount: 4,
    houseArea: 180,
    roofPitchSlider: 35
  });

  const t = TRANSLATIONS[lang] || TRANSLATIONS['en'];
  const { results } = runSolarEngine(inputs);

  // Leaflet GIS Map States
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [weatherInfo, setWeatherInfo] = useState({
    name: 'Москва, Россия',
    lat: '55.75',
    lon: '37.62',
    temp: '18.5',
    minTemp: '-12.0',
    radiation: '14.2',
    dni: '680',
    rain: '58.0 mm / 696 mm',
    solarHours: '1850'
  });
  const [aiClimateLoading, setAiClimateLoading] = useState(false);
  const [aiClimateReport, setAiClimateReport] = useState('');

  // Handle GIS coordinate changes and fetch weather details from Open-Meteo
  const handleLocationChange = async (lat, lon, displayName = '') => {
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lon]);
    }
    
    let name = displayName;
    if (!name) {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const data = await res.json();
        name = data.display_name || `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      } catch {
        name = `${lat.toFixed(3)}, ${lon.toFixed(3)}`;
      }
    }

    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,shortwave_radiation_sum,precipitation_sum,sunshine_duration&past_days=30&forecast_days=0&timezone=auto`);
      const data = await res.json();
      if (data && data.daily) {
        const tempsMax = data.daily.temperature_2m_max || [];
        const tempsMin = data.daily.temperature_2m_min || [];
        const rads = data.daily.shortwave_radiation_sum || [];
        const rains = data.daily.precipitation_sum || [];
        const suns = data.daily.sunshine_duration || [];
        
        const avgTempMax = tempsMax.reduce((a, b) => a + b, 0) / tempsMax.length;
        const avgTempMin = tempsMin.reduce((a, b) => a + b, 0) / tempsMin.length;
        const avgTemp = (avgTempMax + avgTempMin) / 2;
        const minTemp = Math.min(...tempsMin);
        const avgRad = rads.reduce((a, b) => a + b, 0) / rads.length;
        
        // Sum precipitation of past 30 days
        const totalRainMonth = rains.reduce((a, b) => a + b, 0);
        const estRainYear = totalRainMonth * 12; // Extrapolate monthly to annual
        
        // Calculate solar hours
        const dailySunHours = suns.map(s => s / 3600);
        const avgDailySunHours = dailySunHours.reduce((a, b) => a + b, 0) / dailySunHours.length;
        const estSolarHoursYear = avgDailySunHours * 365;

        // DNI and DHI estimations based on average radiation sum
        const dniEst = Math.min(1100, Math.max(450, 800 * (avgRad / 18) + 100));
        const dhiEst = Math.min(300, Math.max(100, 150 * (avgRad / 18)));

        setInputs(prev => ({
          ...prev,
          latitude: parseFloat(lat.toFixed(2)),
          tAmbient: Math.round(avgTemp),
          tLowest: Math.round(minTemp),
          dni: Math.round(dniEst),
          dhi: Math.round(dhiEst),
          solarHours: Math.round(estSolarHoursYear)
        }));

        setWeatherInfo({
          name,
          lat: lat.toFixed(2),
          lon: lon.toFixed(2),
          temp: avgTemp.toFixed(1),
          minTemp: minTemp.toFixed(1),
          radiation: avgRad.toFixed(1),
          dni: Math.round(dniEst),
          rain: `${totalRainMonth.toFixed(1)} mm / ${estRainYear.toFixed(0)} mm`,
          solarHours: estSolarHoursYear.toFixed(0)
        });
      }
    } catch (err) {
      console.error("Open-Meteo API error:", err);
    }
  };

  // Handle search queries using Nominatim
  const handleSearchLocation = async () => {
    if (!searchQuery) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const parsedLat = parseFloat(lat);
        const parsedLon = parseFloat(lon);
        
        if (mapRef.current) {
          mapRef.current.setView([parsedLat, parsedLon], 8);
        }
        handleLocationChange(parsedLat, parsedLon, display_name);
      } else {
        alert(lang === 'ru' ? "Локация не найдена!" : "Location not found!");
      }
    } catch (e) {
      console.error("Geocoding failed:", e);
    }
  };

  // Leaflet Map Init
  useEffect(() => {
    if (!userLevel) return;
    
    // Wait for Leaflet DOM container to be ready
    const timer = setTimeout(() => {
      if (mapRef.current) return;
      if (!window.L) {
        console.error("Leaflet CDN is not loaded yet.");
        return;
      }
      
      try {
        const map = window.L.map('leaflet-map').setView([55.75, 37.62], 4);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap'
        }).addTo(map);

        const marker = window.L.marker([55.75, 37.62]).addTo(map);
        
        mapRef.current = map;
        markerRef.current = marker;

        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          handleLocationChange(lat, lng);
        });
      } catch (err) {
        console.error("Map initialization failed:", err);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [userLevel]);

  // Ask Gemini AI for detailed climate suitability report
  const handleAIClimateAnalysis = async () => {
    if (!apiKey) {
      alert(t.aiNoKeyError);
      return;
    }

    setAiClimateLoading(true);
    setAiClimateReport('');

    let prompt = `You are the EcoPulse Pro Solar AI consultant. Provide a professional, detailed assessment of climate and energy suitability for the following location:\n`;
    prompt += `- Location Name: ${weatherInfo.name}\n`;
    prompt += `- Latitude: ${weatherInfo.lat}°, Longitude: ${weatherInfo.lon}°\n`;
    prompt += `- Average Temperature (last 30 days): ${weatherInfo.temp} °C\n`;
    prompt += `- Winter Minimum (last 30 days): ${weatherInfo.minTemp} °C\n`;
    prompt += `- Precipitation / Rainfall (last 30 days / extrapolated annual): ${weatherInfo.rain}\n`;
    prompt += `- Annual Sunshine Duration: ${weatherInfo.solarHours} hours\n`;
    prompt += `- Estimated GHI / DNI: ${weatherInfo.dni} W/m2\n\n`;
    prompt += `Task: Write a concise paragraph in ${lang === 'ru' ? 'Russian' : 'English'} analyzing the location's climate. Address:\n`;
    prompt += `1. Solar resource potential (suitability for solar PV panels).\n`;
    prompt += `2. Precipitation/weather risks (cleaning needs, battery autonomy sizing based on average rainfall/cloudiness).\n`;
    prompt += `3. Heat/Cold limits (suitability for heliosystems / solar thermal and battery temperature protection).\n`;
    prompt += `Use professional engineering terms and keep the report structured and clean (about 4-5 sentences, no markdown header).`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAiClimateReport(data.candidates[0].content.parts[0].text);
      } else {
        setAiClimateReport("Error: Invalid response format from Gemini API. Verify your API key.");
      }
    } catch (err) {
      setAiClimateReport(`Failed to query Gemini API: ${err.message}`);
    } finally {
      setAiClimateLoading(false);
    }
  };

  // Compliance Audit Dialog states
  const canvasRef = useRef(null);
  const [activeFormulaBlock, setActiveFormulaBlock] = useState('block1');
  
  // Tooltip & Help states
  const [activeTooltip, setActiveTooltip] = useState(null);

  // Real Gemini AI Integration States
  const [apiKey, setApiKey] = useState('');
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const hasViolations = Object.values(results).some(r => !r.compliant);

  // Gemini API client call
  const handleAskAI = async (type = 'question') => {
    if (!apiKey) {
      alert(t.aiNoKeyError);
      return;
    }

    setAiLoading(true);
    setAiResponse('');

    let prompt = t.aiPromptBase + `\n`;
    prompt += `- GHI: ${results.rule1.val} W/m2\n`;
    prompt += `- Cell Temp: ${results.rule2.val} C\n`;
    prompt += `- Cold String Voc: ${results.rule5.val} V (Inverter limit: ${inputs.vInverterLimit} V)\n`;
    prompt += `- Fuse sizing: ${results.rule10.val} A (Fuse Type: ${inputs.fuseType})\n`;
    prompt += `- Downstream RCD: ${inputs.rcdType}\n`;
    prompt += `- Upstream RCD: ${inputs.upstreamRcdType}\n`;
    prompt += `- Battery Chemistry: ${inputs.batteryType}\n`;
    prompt += `- BMS: ${inputs.bmsType}\n`;

    if (type === 'optimize') {
      prompt += `Task: Evaluate the design parameters against compliance errors, propose mechanical and electrical changes to optimize yield, and outline which variables should be changed to secure green status.`;
    } else {
      prompt += `User Question: "${aiQuery}"\nTask: Answer the user question accurately based on the solar rules and active system variables.`;
    }

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      });

      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        setAiResponse(data.candidates[0].content.parts[0].text);
      } else {
        setAiResponse("Error: Invalid response format from Gemini API. Verify your API key.");
      }
    } catch (err) {
      setAiResponse(`Failed to query Gemini API: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Canvas schematic renderer
  useEffect(() => {
    if (!userLevel) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = 800;
    const height = 450;
    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }

    // DC lines
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(110, 150); ctx.lineTo(190, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(250, 150); ctx.lineTo(315, 150); ctx.stroke();

    // SPD Line
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(280, 150); ctx.lineTo(280, 230); ctx.stroke();

    // AC Line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(385, 150); ctx.lineTo(460, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(496, 150); ctx.lineTo(650, 150); ctx.stroke();

    // Battery Line
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(350, 185); ctx.lineTo(350, 290); ctx.stroke();

    // Symbols
    // PV Array
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 2; ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(60, 175); ctx.lineTo(100, 175); ctx.lineTo(90, 125); ctx.lineTo(50, 125);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3f4f6'; ctx.font = '9px Fira Code'; ctx.textAlign = 'center';
    ctx.fillText(`${inputs.panelsPerString}x ${inputs.pSTC}W`, 75, 192);

    // Fuse
    ctx.strokeStyle = !results.rule10.compliant ? '#ef4444' : '#f59e0b';
    ctx.fillStyle = '#111827';
    ctx.beginPath(); ctx.rect(200, 142, 40, 16); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(190, 150); ctx.lineTo(250, 150); ctx.stroke();
    ctx.fillStyle = '#f3f4f6'; ctx.font = '8px Fira Code';
    ctx.fillText(`${results.rule10.val}A DC`, 220, 136);

    // SPD
    ctx.strokeStyle = !results.rule13.compliant ? '#ef4444' : '#06b6d4';
    ctx.beginPath(); ctx.moveTo(280, 225); ctx.lineTo(265, 255); ctx.lineTo(295, 255); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f3f4f6'; ctx.fillText('SPD', 280, 216);

    // Inverter
    ctx.strokeStyle = '#3b82f6';
    ctx.beginPath(); ctx.rect(315, 115, 70, 70); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(315, 185); ctx.lineTo(385, 115); ctx.stroke();
    ctx.fillText('INV', 350, 140);
    ctx.fillText(`${inputs.inverterRating}kW`, 350, 160);

    // Battery
    ctx.strokeStyle = '#f59e0b';
    ctx.beginPath(); ctx.rect(325, 290, 50, 40); ctx.fill(); ctx.stroke();
    ctx.fillText('BAT', 350, 314);

    // RCD
    ctx.strokeStyle = !results.rule14.compliant ? '#ef4444' : '#8b5cf6';
    ctx.beginPath(); ctx.arc(478, 150, 18, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
    ctx.fillText('RCD', 478, 126);

    // Home Load
    ctx.strokeStyle = '#10b981';
    ctx.beginPath(); ctx.moveTo(680, 130); ctx.lineTo(655, 160); ctx.lineTo(705, 160); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillText('LOAD', 680, 175);

    // Compliance banner
    if (hasViolations) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(0, height - 35, width, 35);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'left';
      ctx.fillText('⚠️ DESIGN COMPLIANCE ALERT: Safe operational parameters exceeded.', 15, height - 12);
    } else {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillRect(0, height - 35, width, 35);
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px Inter'; ctx.textAlign = 'left';
      ctx.fillText('✅ B2B COMPLIANCE SECURED: Engineering design conforms to NEC & IEC standards.', 15, height - 12);
    }
  }, [inputs, results, lang, userLevel, hasViolations]);



  return (
    <div className="min-h-screen bg-[#070a13] bg-grid-pattern text-slate-100 flex flex-col font-sans">
      
      {/* HEADER */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-emerald-500 to-blue-600 rounded-lg shadow-lg">
            <Sun className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="font-heading font-extrabold text-xl tracking-tight bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent m-0">
              {t.title}
            </h1>
            <p className="text-xs text-slate-400 font-medium">{t.subtitle}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">


          <div className="flex bg-slate-900 rounded-lg p-1 border border-white/10 text-xs">
            {['ru', 'en', 'zh', 'es', 'fr'].map(l => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2 py-0.5 font-bold rounded uppercase ${lang === l ? 'bg-emerald-500 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SIDE design inputs */}
        <aside className="lg:col-span-4 flex flex-col space-y-6">
          
          {/* GIS MAP CARD */}
          <div className="glass-panel rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="font-heading font-bold text-sm text-white flex items-center space-x-2 border-b border-white/5 pb-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span>{t.mapTitle}</span>
            </h2>
            <p className="text-[10px] text-slate-400 leading-normal">{t.mapDesc}</p>
            
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder={t.mapSearchPlaceholder}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 p-2 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSearchLocation();
                }}
              />
              <button
                onClick={handleSearchLocation}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded text-xs font-bold transition text-white"
              >
                {t.mapSearchBtn}
              </button>
            </div>

            {/* Leaflet Map Div */}
            <div id="leaflet-map" className="h-[180px] w-full rounded-xl border border-white/10 overflow-hidden relative z-10"></div>

            {/* Local Weather info card */}
            {weatherInfo && (
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 text-[10px] text-slate-300 font-mono space-y-1.5">
                <div className="font-bold text-slate-200 flex items-center space-x-1.5">
                  <span>🌍 {weatherInfo.name}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                  <div><span className="text-slate-500">{t.mapInfoCoords}:</span> {weatherInfo.lat}°, {weatherInfo.lon}°</div>
                  <div><span className="text-slate-500">{t.mapInfoTemp}:</span> {weatherInfo.temp}°C</div>
                  <div><span className="text-slate-500">{t.mapInfoMin}:</span> {weatherInfo.minTemp}°C</div>
                  <div><span className="text-slate-500">{t.mapInfoDni}:</span> {weatherInfo.dni} W/m²</div>
                  <div className="col-span-2"><span className="text-slate-500">{t.mapInfoRain}:</span> {weatherInfo.rain}</div>
                  <div className="col-span-2"><span className="text-slate-500">{t.mapInfoSolarHours}:</span> {weatherInfo.solarHours} hrs</div>
                </div>

                <div className="mt-3 pt-3 border-t border-white/5">
                  <button
                    onClick={handleAIClimateAnalysis}
                    disabled={aiClimateLoading}
                    className="w-full py-1.5 px-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 disabled:opacity-50 text-[10px] text-white font-bold rounded-lg transition"
                  >
                    {aiClimateLoading ? t.mapAiAnalyzeLoading : t.mapAiAnalyzeBtn}
                  </button>
                </div>

                {aiClimateReport && (
                  <div className="mt-2.5 p-2 bg-slate-950 rounded-lg border border-white/5 text-[9px] text-teal-300 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {aiClimateReport}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* DESIGN PARAMETERS */}
          <div className="glass-panel rounded-2xl p-5 shadow-xl flex flex-col max-h-[55vh] overflow-y-auto space-y-5">
            <h2 className="font-heading font-bold text-lg border-b border-white/5 pb-3 flex justify-between items-center">
              <span>{t.tabWizard}</span>
            </h2>

            {/* Section 1: Astrophysics & Climate */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-emerald-400 tracking-wider uppercase border-l-2 border-emerald-500 pl-2">{t.secAstro}</h3>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.dni}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'dni' ? null : 'dni')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.dni} W/m²</span>
                </label>
                {activeTooltip === 'dni' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_dni}</div>}
                <input type="range" min="100" max="1200" step="10" value={inputs.dni} onChange={e => setInputs({...inputs, dni: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.dhi}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'dhi' ? null : 'dhi')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.dhi} W/m²</span>
                </label>
                {activeTooltip === 'dhi' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_dhi}</div>}
                <input type="range" min="0" max="400" step="5" value={inputs.dhi} onChange={e => setInputs({...inputs, dhi: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.tAmbient}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'tAmbient' ? null : 'tAmbient')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.tAmbient}°C</span>
                </label>
                {activeTooltip === 'tAmbient' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_tAmbient}</div>}
                <input type="range" min="-10" max="50" step="1" value={inputs.tAmbient} onChange={e => setInputs({...inputs, tAmbient: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              {userLevel !== 'beginner' && (
                <div>
                  <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                    <span className="flex items-center space-x-1.5">
                      <span>{t.tLowest}</span>
                      <button onClick={() => setActiveTooltip(activeTooltip === 'tLowest' ? null : 'tLowest')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                    </span>
                    <span className="text-white font-bold">{inputs.tLowest}°C</span>
                  </label>
                  {activeTooltip === 'tLowest' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_tLowest}</div>}
                  <input type="range" min="-45" max="15" step="1" value={inputs.tLowest} onChange={e => setInputs({...inputs, tLowest: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
                </div>
              )}

              <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-white/5">
                <span className="text-xs text-slate-300 font-mono">{t.isRoof}</span>
                <input type="checkbox" checked={inputs.isRoofMounted} onChange={e => setInputs({...inputs, isRoofMounted: e.target.checked})} className="h-4 w-4 rounded accent-emerald-400 cursor-pointer" />
              </div>
            </div>

            {/* Section 2: Optics & Strings */}
            <div className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold text-blue-400 tracking-wider uppercase border-l-2 border-blue-500 pl-2">{t.secOptics}</h3>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.panelPower}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'panelPower' ? null : 'panelPower')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.pSTC} W</span>
                </label>
                {activeTooltip === 'panelPower' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_panelPower}</div>}
                <input type="range" min="250" max="700" step="5" value={inputs.pSTC} onChange={e => setInputs({...inputs, pSTC: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.pitch}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'pitch' ? null : 'pitch')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.pitchAngle}°</span>
                </label>
                {activeTooltip === 'pitch' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_pitch}</div>}
                <input type="range" min="0" max="90" step="1" value={inputs.pitchAngle} onChange={e => setInputs({...inputs, pitchAngle: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span className="flex items-center space-x-1.5">
                    <span>{t.panelsPerString}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'panelsPerString' ? null : 'panelsPerString')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </span>
                  <span className="text-white font-bold">{inputs.panelsPerString} units</span>
                </label>
                {activeTooltip === 'panelsPerString' && <div className="text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 border border-blue-500/20">{t.tip_panelsPerString}</div>}
                <input type="range" min="1" max="28" step="1" value={inputs.panelsPerString} onChange={e => setInputs({...inputs, panelsPerString: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-white/5">
                <span className="text-xs text-slate-300 font-mono">{t.isBifacial}</span>
                <input type="checkbox" checked={inputs.isBifacial} onChange={e => setInputs({...inputs, isBifacial: e.target.checked})} className="h-4 w-4 rounded accent-emerald-400 cursor-pointer" />
              </div>

              <div>
                <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                  <span>{t.albedo}</span>
                </label>
                <select value={inputs.albedoType} onChange={e => setInputs({...inputs, albedoType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                  <option value="Concrete">Concrete (0.25)</option>
                  <option value="Grass">Grass (0.20)</option>
                  <option value="Snow">Snow (0.75)</option>
                </select>
              </div>
            </div>

            {/* Section 3: Safety & Protection */}
            <div className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold text-purple-400 tracking-wider uppercase border-l-2 border-purple-500 pl-2">{t.secSafety}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.fuseType}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'fuseType' ? null : 'fuseType')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </label>
                  {activeTooltip === 'fuseType' && <div className="absolute z-10 text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 max-w-[200px] border border-blue-500/20">{t.tip_fuseType}</div>}
                  <select value={inputs.fuseType} onChange={e => setInputs({...inputs, fuseType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="DC Fuse">DC Fuse</option>
                    <option value="AC Breaker">AC Breaker</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.rcdType}</span>
                    <button onClick={() => setActiveTooltip(activeTooltip === 'rcdType' ? null : 'rcdType')} className="cursor-pointer text-slate-500 hover:text-slate-300"><HelpCircle className="h-3.5 w-3.5" /></button>
                  </label>
                  {activeTooltip === 'rcdType' && <div className="absolute z-10 text-[10px] text-blue-300 bg-slate-900 p-2 rounded mt-1 max-w-[200px] border border-blue-500/20">{t.tip_rcdType}</div>}
                  <select value={inputs.rcdType} onChange={e => setInputs({...inputs, rcdType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="Type B">Type B</option>
                    <option value="Type A">Type A</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.upRcdType}</span>
                  </label>
                  <select value={inputs.upstreamRcdType} onChange={e => setInputs({...inputs, upstreamRcdType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="Type B">Type B</option>
                    <option value="Type A">Type A</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.wireArea}</span>
                  </label>
                  <select value={inputs.wireArea} onChange={e => setInputs({...inputs, wireArea: parseInt(e.target.value)})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="4">4 mm²</option>
                    <option value="6">6 mm²</option>
                    <option value="10">10 mm²</option>
                    <option value="16">16 mm²</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.wireLength}</span>
                  <span className="text-white font-bold">{inputs.wireLength} m</span>
                </label>
                <input type="range" min="5" max="100" step="5" value={inputs.wireLength} onChange={e => setInputs({...inputs, wireLength: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.cablesInPipe}</span>
                  <span className="text-white font-bold">{inputs.cablesInConduit} units</span>
                </label>
                <input type="range" min="1" max="8" step="1" value={inputs.cablesInConduit} onChange={e => setInputs({...inputs, cablesInConduit: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>
            </div>

            {/* Section 4: Inverter & Battery */}
            <div className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold text-yellow-500 tracking-wider uppercase border-l-2 border-yellow-500 pl-2">{t.secInverters}</h3>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.invPower}</span>
                  <span className="text-white font-bold">{inputs.inverterRating} kW</span>
                </label>
                <input type="range" min="1" max="50" step="1" value={inputs.inverterRating} onChange={e => setInputs({...inputs, inverterRating: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.batteryType}</span>
                  </label>
                  <select value={inputs.batteryType} onChange={e => setInputs({...inputs, batteryType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="LiFePO4">LiFePO4</option>
                    <option value="GEL">GEL Lead-Acid</option>
                    <option value="Na-Ion">Sodium-Ion (Na-Ion)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-mono flex items-center space-x-1">
                    <span>{t.bmsType}</span>
                  </label>
                  <select value={inputs.bmsType} onChange={e => setInputs({...inputs, bmsType: e.target.value})} className="w-full p-2 mt-1 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none">
                    <option value="Active">Active</option>
                    <option value="Passive">Passive</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.batteryCap}</span>
                  <span className="text-white font-bold">{inputs.batteryCapacity} Ah</span>
                </label>
                <input type="range" min="50" max="500" step="10" value={inputs.batteryCapacity} onChange={e => setInputs({...inputs, batteryCapacity: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>
            </div>

            {/* Section 5: Economics & ESG */}
            <div className="space-y-4 border-t border-white/5 pt-4">
              <h3 className="text-xs font-bold text-teal-400 tracking-wider uppercase border-l-2 border-teal-500 pl-2">{t.secEconomy}</h3>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.windSpeed}</span>
                  <span className="text-white font-bold">{inputs.windSpeed} m/s</span>
                </label>
                <input type="range" min="0" max="60" step="2" value={inputs.windSpeed} onChange={e => setInputs({...inputs, windSpeed: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.occupants}</span>
                  <span className="text-white font-bold">{inputs.occupantsCount} people</span>
                </label>
                <input type="range" min="1" max="10" step="1" value={inputs.occupantsCount} onChange={e => setInputs({...inputs, occupantsCount: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>
              <div>
                <label className="text-xs text-slate-400 flex items-center justify-between font-mono">
                  <span>{t.houseArea}</span>
                  <span className="text-white font-bold">{inputs.houseArea} m²</span>
                </label>
                <input type="range" min="30" max="500" step="5" value={inputs.houseArea} onChange={e => setInputs({...inputs, houseArea: parseInt(e.target.value)})} className="w-full cursor-pointer accent-emerald-400" />
              </div>
            </div>
          </div>
        </aside>

        {/* VIEWPORTS */}
        <main className="lg:col-span-8 flex flex-col space-y-6">
          
          <nav className="flex space-x-1 bg-slate-900 p-1.5 rounded-xl border border-white/5">
            {[
              { id: 'dashboard', label: t.tabDashboard, icon: Leaf },
              { id: 'sld', label: t.tabSld, icon: Eye },
              { id: 'formulas', label: t.tabFormulas, icon: FileText },
            ].map(tabItem => {
              const Icon = tabItem.icon;
              return (
                <button
                  key={tabItem.id}
                  onClick={() => setActiveTab(tabItem.id)}
                  className={`flex-1 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
                    activeTab === tabItem.id 
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tabItem.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1">
            
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                
                {/* ESG Counter */}
                <div className="glass-panel-glow-green rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-32 w-32 bg-emerald-500/10 rounded-full filter blur-2xl"></div>
                  <div className="flex items-center space-x-3 mb-6">
                    <Leaf className="h-7 w-7 text-emerald-400" />
                    <h2 className="font-heading font-extrabold text-xl m-0">{t.esgTitle}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-6">{t.esgDesc}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-slate-950/50 rounded-2xl p-5 border border-white/5">
                      <span className="text-xs text-slate-400 font-bold uppercase">{t.co2Saved}</span>
                      <div className="mt-2 text-3xl font-extrabold text-emerald-400 font-mono">
                        {results.rule27.equivalents.co2} t
                      </div>
                    </div>
                    <div className="bg-slate-950/50 rounded-2xl p-5 border border-white/5">
                      <span className="text-xs text-slate-400 font-bold uppercase">{t.forestSaved}</span>
                      <div className="mt-2 text-3xl font-extrabold text-teal-400 font-mono">
                        {results.rule27.equivalents.forest} Ha
                      </div>
                      <p className="text-[10px] text-slate-500 mt-2">{t.forestDesc}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between border border-white/5">
                    <Car className="h-6 w-6 text-blue-400" />
                    <span className="text-xs text-slate-400 font-bold uppercase mt-3">{t.carsReplaced}</span>
                    <div className="text-2xl font-extrabold text-blue-400 font-mono mt-1">
                      {results.rule27.equivalents.cars}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">{t.carsDesc}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between border border-white/5">
                    <Trees className="h-6 w-6 text-emerald-400" />
                    <span className="text-xs text-slate-400 font-bold uppercase mt-3">{t.treesPlanted}</span>
                    <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
                      {results.rule27.equivalents.trees}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">{t.treesDesc}</p>
                  </div>
                  <div className="glass-panel rounded-2xl p-5 flex flex-col justify-between border border-white/5">
                    <Flame className="h-6 w-6 text-amber-500" />
                    <span className="text-xs text-slate-400 font-bold uppercase mt-3">{t.coalSaved}</span>
                    <div className="text-2xl font-extrabold text-amber-500 font-mono mt-1">
                      {results.rule27.equivalents.coal}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">{t.coalDesc}</p>
                  </div>
                </div>

                {/* Gemini AI Copilot Integration Card */}
                <div className="glass-panel rounded-3xl p-6 border border-blue-500/20 shadow-2xl relative overflow-hidden">
                  <div className="absolute right-0 top-0 h-32 w-32 bg-blue-500/10 rounded-full filter blur-2xl"></div>
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-400">
                      <Key className="h-5 w-5" />
                    </div>
                    <h2 className="font-heading font-extrabold text-lg text-white m-0">{t.aiTitle}</h2>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">{t.aiDesc}</p>

                  {/* Free API key instructions */}
                  <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 mb-5 space-y-2 text-xs">
                    <span className="font-bold text-slate-300">{t.aiApiKeyLabel}</span>
                    <p className="text-slate-400 text-[11px] leading-relaxed">{t.aiApiKeyInstruction}</p>
                    <input
                      type="password"
                      placeholder="AI Studio API Key (AI_...) "
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full p-2.5 rounded bg-slate-950 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div className="flex flex-col space-y-3">
                    <textarea
                      placeholder={t.aiPlaceholder}
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      className="w-full p-3 rounded bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-blue-500 h-20"
                    />
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleAskAI('question')}
                        disabled={aiLoading || !apiKey}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
                      >
                        {aiLoading ? 'Thinking...' : t.aiBtnAsk}
                      </button>
                      <button
                        onClick={() => handleAskAI('optimize')}
                        disabled={aiLoading || !apiKey}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition"
                      >
                        {aiLoading ? 'Analyzing...' : t.aiBtnOptimize}
                      </button>
                    </div>
                  </div>

                  {aiResponse && (
                    <div className="mt-5 p-4 bg-slate-950 rounded-xl border border-white/5 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-line max-h-72 overflow-y-auto">
                      <span className="font-heading font-bold text-slate-200 block border-b border-white/5 pb-2 mb-2">{t.aiResultsLabel}</span>
                      {aiResponse}
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* Canvas Schematic */}
            {activeTab === 'sld' && (
              <div className="glass-panel rounded-2xl p-5 flex flex-col items-center">
                <div className="w-full flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                  <h2 className="font-heading font-bold text-base text-white m-0">{t.tabSld}</h2>
                  <button 
                    onClick={() => {
                      const canvas = canvasRef.current;
                      if (canvas) {
                        const link = document.createElement('a');
                        link.download = 'EcoPulse_SLD_Schematic.png';
                        link.href = canvas.toDataURL();
                        link.click();
                      }
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    <Download className="h-4.5 w-4.5" />
                    <span>PNG</span>
                  </button>
                </div>
                <canvas ref={canvasRef} className="border border-white/10 rounded-xl max-w-full" />
              </div>
            )}

            {/* Formulas Auditor */}
            {activeTab === 'formulas' && (
              <div className="glass-panel rounded-2xl p-5 space-y-4">
                <h2 className="font-heading font-bold text-lg m-0">{t.formulasTitle}</h2>
                <p className="text-xs text-slate-400 mt-1">{t.formulasDesc}</p>
                
                <div className="flex bg-slate-900 p-1 rounded-xl text-xs overflow-x-auto space-x-2 border border-white/5">
                  {['block1', 'block2', 'block3', 'block4', 'block5'].map(b => (
                    <button
                      key={b}
                      onClick={() => setActiveFormulaBlock(b)}
                      className={`px-3 py-1.5 rounded transition ${activeFormulaBlock === b ? 'bg-slate-800 text-white font-bold' : 'text-slate-400'}`}
                    >
                      {b === 'block1' ? t.secBlock1 : b === 'block2' ? t.secBlock2 : b === 'block3' ? t.secBlock3 : b === 'block4' ? t.secBlock4 : t.secBlock5}
                    </button>
                  ))}
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[480px]">
                  {Object.keys(results).map((key) => {
                    const ruleNum = parseInt(key.replace('rule', ''));
                    let ruleBlock = 'block1';
                    if (ruleNum >= 5 && ruleNum <= 9) ruleBlock = 'block2';
                    else if (ruleNum >= 10 && ruleNum <= 15) ruleBlock = 'block3';
                    else if (ruleNum >= 16 && ruleNum <= 22) ruleBlock = 'block4';
                    else if (ruleNum >= 23 && ruleNum <= 30) ruleBlock = 'block5';

                    if (ruleBlock !== activeFormulaBlock) return null;
                    const r = results[key];

                    return (
                      <div key={key} className="p-4 rounded-xl border border-white/5 bg-slate-900/40">
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
                          <span>RULE {ruleNum}</span>
                          <span className={r.compliant ? 'text-emerald-400' : 'text-red-400'}>
                            {r.compliant ? t.ruleCompliant : t.ruleViolation}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold text-slate-200 mt-2">{r.formula}</h4>
                        <div className="mt-2 p-2.5 bg-slate-950 rounded font-mono text-xs text-teal-400 overflow-x-auto">
                          {r.subs}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">{r.note}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main viewports end */}
          </div>
        </main>

      </div>
      
      <footer className="glass-panel mt-auto py-5 px-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 font-semibold tracking-wide font-mono">
        <p>© 2026 EcoPulse Pro. Engineered for Hackathon.</p>
        <p className="mt-2 md:mt-0 flex items-center space-x-2">
          <span>B2B Engineering Audit Compliant</span>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          <span>Gemini AI Copilot Integrated</span>
        </p>
      </footer>
    </div>
  );
}

export default App;
