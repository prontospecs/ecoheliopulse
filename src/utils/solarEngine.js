/**
 * EcoPulse Pro Core Engineering Engine
 * Computes all 30 B2B solar PV design rules, evaluates compliance, 
 * and generates live formula substitutions.
 */

export const PANEL_TYPES = {
  'Mono-Si': { gamma: -0.35, label: 'Mono-Crystalline Silicon' },
  'HJT': { gamma: -0.24, label: 'Heterojunction (HJT)' }
};

export const BATTERY_TYPES = {
  'LiFePO4': { dod: 0.90, label: 'Lithium Iron Phosphate (LiFePO4)' },
  'GEL': { dod: 0.50, label: 'GEL Lead-Acid' },
  'Na-Ion': { dod: 0.85, label: 'Sodium-Ion (Na-Ion)' }
};

export const ALBEDO_FACTORS = {
  'Concrete': { factor: 0.20, label: 'White Concrete (+20%)' },
  'Grass': { factor: 0.04, label: 'Green Grass (+4%)' },
  'Snow': { factor: 0.60, label: 'Fresh Snow (+60%)' },
  'Soil': { factor: 0.08, label: 'Dry Soil (+8%)' }
};

/**
 * Run all 30 calculations based on user inputs.
 */
export function runSolarEngine(inputs) {
  const results = {};

  // Standardize inputs
  const GHI_dni = parseFloat(inputs.dni || 800);
  const GHI_dhi = parseFloat(inputs.dhi || 150);
  const zenithAngle = parseFloat(inputs.zenithAngle || 30);
  const zenithRad = (zenithAngle * Math.PI) / 180;
  const GHI = GHI_dni * Math.cos(zenithRad) + GHI_dhi;

  const tAmbient = parseFloat(inputs.tAmbient || 25);
  const tNoct = parseFloat(inputs.tNoct || 45);
  const isRoofMounted = !!inputs.isRoofMounted;
  const pSTC = parseFloat(inputs.pSTC || 400);
  const panelType = inputs.panelType || 'Mono-Si';
  const gamma = PANEL_TYPES[panelType] ? PANEL_TYPES[panelType].gamma : -0.35;
  const pitchAngle = parseFloat(inputs.pitchAngle || 35);
  const orientation = inputs.orientation || 'South';
  
  const tLowest = parseFloat(inputs.tLowest || -15);
  const vOc = parseFloat(inputs.vOc || 48);
  const iSc = parseFloat(inputs.iSc || 13);
  const gammaVoc = parseFloat(inputs.gammaVoc || -0.28);
  const vInverterLimit = parseFloat(inputs.vInverterLimit || 800);
  const panelsPerString = parseInt(inputs.panelsPerString || 10);
  
  const obstacleHeight = parseFloat(inputs.obstacleHeight || 3);
  const latitude = parseFloat(inputs.latitude || 41);
  const isBifacial = !!inputs.isBifacial;
  const albedoType = inputs.albedoType || 'Concrete';
  const albedoVal = ALBEDO_FACTORS[albedoType] ? ALBEDO_FACTORS[albedoType].factor : 0.20;
  
  const daysSinceCleaning = parseFloat(inputs.daysSinceCleaning || 30);
  const soilingLossMax = parseFloat(inputs.soilingLossMax || 10);
  const soilingFactorK = parseFloat(inputs.soilingFactorK || 0.05);
  
  const hasBlockingDiodes = !!inputs.hasBlockingDiodes;
  const fuseType = inputs.fuseType || 'DC Fuse'; // DC Fuse vs AC Breaker
  
  const cablesInConduit = parseInt(inputs.cablesInConduit || 4);
  const wireLength = parseFloat(inputs.wireLength || 15);
  const wireMaterial = inputs.wireMaterial || 'Copper';
  const wireArea = parseFloat(inputs.wireArea || 4); // mm²
  const baseCurrentCapacity = parseFloat(inputs.baseCurrentCapacity || 35); // Amps

  const hasSPD = !!inputs.hasSPD;
  const spdType = inputs.spdType || 'Type 2';
  const groundingLength = parseFloat(inputs.groundingLength || 45); // cm
  
  const rcdType = inputs.rcdType || 'Type B';
  const upstreamRcdType = inputs.upstreamRcdType || 'Type B';
  
  const inverterRating = parseFloat(inputs.inverterRating || 10); // kW
  const mpptType = inputs.mpptType || 'MPPT';
  const windSpeed = parseFloat(inputs.windSpeed || 25);
  const panelArea = parseFloat(inputs.panelArea || 20); // m²
  
  const criticalLoad = parseFloat(inputs.criticalLoad || 12); // kWh/day
  const batteryType = inputs.batteryType || 'LiFePO4';
  const daysOfAutonomy = parseFloat(inputs.daysOfAutonomy || 2);
  const batteryCapacity = parseFloat(inputs.batteryCapacity || 100); // Ah
  // const batteryVoltage = parseFloat(inputs.batteryVoltage || 48); // V
  const bmsType = inputs.bmsType || 'Active';
  
  const batterySOC = parseFloat(inputs.batterySOC || 15);
  const hasV2H = !!inputs.hasV2H;
  const hasDryContact = !!inputs.hasDryContact;
  
  const zeroExportEnabled = !!inputs.zeroExportEnabled;
  const loadPower = parseFloat(inputs.loadPower || 3.0);
  const gridTarget = parseFloat(inputs.gridTarget || 0.1);
  const hasHeatPump = !!inputs.hasHeatPump;
  
  const lidFactor = parseFloat(inputs.lidFactor || 2.0); // %
  const annualDegradation = parseFloat(inputs.annualDegradation || 0.5); // %
  const operationYears = parseInt(inputs.operationYears || 25);
  
  const systemPowerKW = (pSTC * panelsPerString) / 1000;
  const solarHours = parseFloat(inputs.solarHours || 1850);
  const totalGenYearly = systemPowerKW * solarHours * 0.80; 
  const eDirectYearly = totalGenYearly * 0.70;
  const eExportYearly = totalGenYearly * 0.30;
  const tariffRetail = parseFloat(inputs.tariffRetail || 0.15);
  const tariffFeedIn = parseFloat(inputs.tariffFeedIn || 0.05);
  const opexYearly = parseFloat(inputs.opexYearly || 200);
  const inflationRate = parseFloat(inputs.inflationRate || 4.0);
  const gridEmissionFactor = parseFloat(inputs.gridEmissionFactor || 0.5); // kg CO2 / kWh
  
  const occupantsCount = parseInt(inputs.occupantsCount || 4);
  const houseArea = parseFloat(inputs.houseArea || 150);
  const roofPitchSlider = parseFloat(inputs.roofPitchSlider || 35);

  // -------------------------------------------------------------
  // BLOCK I: ASTROPHYSICS & TEMPERATURE (Rules 1-4)
  // -------------------------------------------------------------

  // Rule 1: GHI Sizing
  results.rule1 = {
    compliant: GHI > 0,
    val: GHI.toFixed(1),
    unit: 'W/m²',
    formula: 'GHI = DNI * cos(θz) + DHI',
    subs: `GHI = ${GHI_dni} * cos(${zenithAngle}°) + ${GHI_dhi} = ${GHI.toFixed(1)} W/m²`
  };

  // Rule 2: NOCT Cell Temp (Roof mounts get hotter)
  const roofAdder = isRoofMounted ? 12 : 0; 
  const T_cell = tAmbient + roofAdder + ((tNoct - 20) / 800) * GHI;
  results.rule2 = {
    compliant: T_cell < 75, 
    val: T_cell.toFixed(1),
    unit: '°C',
    formula: 'Tcell = Tambient + Troof_adder + ((Tnoct - 20)/800) * GHI',
    subs: `Tcell = ${tAmbient} + ${roofAdder} + ((${tNoct} - 20)/800) * ${GHI.toFixed(1)} = ${T_cell.toFixed(1)} °C`,
    note: isRoofMounted ? 'Roof mounting penalty (+12°C) applied' : 'Ground mounting (standard NOCT)'
  };

  // Rule 3: Temperature degradation
  const P_actual = pSTC * (GHI / 1000) * (1 + (gamma / 100) * (T_cell - 25));
  const powerLossPercent = Math.abs((gamma * (T_cell - 25))).toFixed(1);
  results.rule3 = {
    compliant: T_cell < 65 || panelType === 'HJT', 
    val: P_actual.toFixed(1),
    unit: 'W',
    formula: 'Pactual = Pstc * (Gactual / 1000) * (1 + (γ/100) * (Tcell - 25))',
    subs: `Pactual = ${pSTC} * (${GHI.toFixed(1)}/1000) * (1 + (${gamma}/100) * (${T_cell.toFixed(1)} - 25)) = ${P_actual.toFixed(1)} W`,
    note: `Power temperature degradation: -${powerLossPercent}% (Panel Type: ${panelType})`
  };

  // Rule 4: Winter Optimization
  let pitchCompliance = true;
  let winterNote;
  if (orientation === 'East-West' && pitchAngle === 90) {
    winterNote = 'Vertical East-West design provides +24% winter generation and natural snow clearing.';
  } else if (pitchAngle >= 65 && pitchAngle <= 70) {
    winterNote = 'Optimal winter angle (65-70°) selected. Promotes sliding of accumulated snow.';
  } else {
    pitchCompliance = false;
    winterNote = 'Warning: Angle is suboptimal for snow shedding (needs 65-70° or vertical 90° East-West).';
  }
  results.rule4 = {
    compliant: pitchCompliance,
    val: pitchAngle,
    unit: '°',
    formula: 'Pitch ∈ [65, 70]° or (Orientation = E-W and Pitch = 90°)',
    subs: `Pitch = ${pitchAngle}°, Orientation = ${orientation}`,
    note: winterNote
  };

  // -------------------------------------------------------------
  // BLOCK II: OPTICS & STRINGS (Rules 5-9)
  // -------------------------------------------------------------

  // Rule 5: Cold String Inverter Explosion Risk
  const V_oc_cold = vOc * (1 + (gammaVoc / 100) * (tLowest - 25));
  const totalStringVocCold = V_oc_cold * panelsPerString;
  const inverterOvervoltage = totalStringVocCold > vInverterLimit;
  results.rule5 = {
    compliant: !inverterOvervoltage,
    val: totalStringVocCold.toFixed(1),
    unit: 'V',
    formula: 'Voc_cold_string = N * Voc * (1 + (γVoc/100) * (Tlowest - 25))',
    subs: `Voc_cold_string = ${panelsPerString} * ${vOc} * (1 + (${gammaVoc}/100) * (${tLowest} - 25)) = ${totalStringVocCold.toFixed(1)} V`,
    note: inverterOvervoltage 
      ? `CRITICAL ERROR: Cold Voc (${totalStringVocCold.toFixed(1)}V) exceeds inverter DC limit (${vInverterLimit}V) by ${(totalStringVocCold - vInverterLimit).toFixed(1)}V! INVERTER EXPLOSION RISK!`
      : `Safe: Cold Voc (${totalStringVocCold.toFixed(1)}V) is within inverter DC limit (${vInverterLimit}V).`
  };

  // Rule 6: Winter shadow trigonometry
  const alphaSun = 90 - (latitude + 23.44);
  const alphaRad = (alphaSun * Math.PI) / 180;
  const L_shadow = obstacleHeight / Math.tan(alphaRad);
  results.rule6 = {
    compliant: alphaSun > 0,
    val: L_shadow.toFixed(2),
    unit: 'm',
    formula: 'Lshadow = H / tan(α) where α = 90° - (Latitude + 23.44°)',
    subs: `α = 90° - (${latitude}° + 23.44°) = ${alphaSun.toFixed(2)}°. Lshadow = ${obstacleHeight} / tan(${alphaSun.toFixed(2)}°) = ${L_shadow.toFixed(2)} m`,
    note: `Minimum distance behind a ${obstacleHeight}m barrier on Dec 21 is ${L_shadow.toFixed(2)}m.`
  };

  // Rule 7: Albedo Gain
  const bifacialGainPercent = isBifacial ? (albedoVal * 100).toFixed(0) : 0;
  const actualPanelPowerBifacial = P_actual * (1 + (isBifacial ? albedoVal : 0));
  results.rule7 = {
    compliant: true,
    val: actualPanelPowerBifacial.toFixed(1),
    unit: 'W',
    formula: 'Pbifacial = Pactual * (1 + Albedo_factor * isBifacial)',
    subs: `Pbifacial = ${P_actual.toFixed(1)} * (1 + ${albedoVal} * ${isBifacial ? 1 : 0}) = ${actualPanelPowerBifacial.toFixed(1)} W`,
    note: isBifacial 
      ? `Bifacial panels activated. Ground Albedo (${albedoType}) yields +${bifacialGainPercent}% rear side energy.`
      : 'Monofacial panel selected. No albedo bonus calculated.'
  };

  // Rule 8: Soiling Losses
  const L_soiling = soilingLossMax * (1 - Math.exp(-soilingFactorK * daysSinceCleaning));
  results.rule8 = {
    compliant: L_soiling < 5,
    val: L_soiling.toFixed(2),
    unit: '%',
    formula: 'Lsoiling = Lmax * (1 - e^(-k * t))',
    subs: `Lsoiling = ${soilingLossMax}% * (1 - e^(-${soilingFactorK} * ${daysSinceCleaning})) = ${L_soiling.toFixed(2)}%`,
    note: L_soiling >= 5 
      ? `Warning: high dust/soiling losses (${L_soiling.toFixed(2)}%). Panel washing required!`
      : `Cleanliness level is acceptable. Soiling loss: ${L_soiling.toFixed(2)}%.`
  };

  // Rule 9: Diodes & OCPD Replacement
  results.rule9 = {
    compliant: !hasBlockingDiodes,
    val: hasBlockingDiodes ? '0.7 V Loss' : 'No Loss',
    unit: '',
    formula: 'Loss = hasBlockingDiodes ? 0.7V : 0V',
    subs: `Blocking Diodes: ${hasBlockingDiodes ? 'Enabled (0.7V drop)' : 'Disabled (Replaced with OCPD fuses)'}`,
    note: hasBlockingDiodes 
      ? 'Warning: Blocking diodes cause a continuous 0.7V voltage drop. Replace with OCPD fuses!'
      : 'Excellent: Blocking diodes omitted. OCPD fuses prevent reverse current without voltage drops.'
  };

  // -------------------------------------------------------------
  // BLOCK III: AC/DC SAFETY (Rules 10-15)
  // -------------------------------------------------------------

  // Rule 10: OCPD DC Fuse Sizing (NEC 690)
  const I_fuse_req = iSc * 1.56;
  const isACInDC = fuseType === 'AC Breaker';
  results.rule10 = {
    compliant: !isACInDC,
    val: I_fuse_req.toFixed(2),
    unit: 'A',
    formula: 'Imax = Isc * 1.56',
    subs: `Imax = ${iSc} * 1.56 = ${I_fuse_req.toFixed(2)} A. Fuse selected: ${fuseType}`,
    note: isACInDC 
      ? 'CRITICAL SAFETY VIOLATION: AC breakers CANNOT extinguish DC arcs. Fire risk! DC Fuses must be used.'
      : `Required fuse rating: ≥ ${I_fuse_req.toFixed(2)} A. Selected: DC Fuse.`
  };

  // Rule 11: Cable Sizing and Derating (NEC 310)
  let C_fill = 1.0;
  if (cablesInConduit >= 4 && cablesInConduit <= 6) C_fill = 0.80;
  else if (cablesInConduit > 6) C_fill = 0.70;
  
  const roofCtemp = isRoofMounted ? tAmbient + 22 : tAmbient;
  let C_temp = 1.0;
  if (roofCtemp > 25 && roofCtemp <= 30) C_temp = 1.0;
  else if (roofCtemp > 30 && roofCtemp <= 35) C_temp = 0.96;
  else if (roofCtemp > 35 && roofCtemp <= 40) C_temp = 0.91;
  else if (roofCtemp > 40 && roofCtemp <= 45) C_temp = 0.87;
  else if (roofCtemp > 45 && roofCtemp <= 50) C_temp = 0.82;
  else if (roofCtemp > 50 && roofCtemp <= 55) C_temp = 0.76;
  else if (roofCtemp > 55) C_temp = 0.58;

  const I_adjusted = baseCurrentCapacity * C_temp * C_fill;
  const continuousCurrentReq = iSc * 1.25; 
  const cableOverloaded = continuousCurrentReq > I_adjusted;

  results.rule11 = {
    compliant: !cableOverloaded,
    val: I_adjusted.toFixed(2),
    unit: 'A',
    formula: 'Iadjusted = Ibase * Ctemp * Cfill',
    subs: `Iadjusted = ${baseCurrentCapacity} * ${C_temp} (T_roof=${roofCtemp.toFixed(0)}°C) * ${C_fill} (fill=${cablesInConduit} cables) = ${I_adjusted.toFixed(2)} A`,
    note: cableOverloaded
      ? `CRITICAL WARNING: Derated cable capacity (${I_adjusted.toFixed(2)}A) is below required current (${continuousCurrentReq.toFixed(2)}A). Cable will overheat! Use a larger wire.`
      : `Cable capacity after roof correction (+22°C) and conduit fill derating is safe (${I_adjusted.toFixed(2)}A).`
  };

  // Rule 12: Voltage Drop
  const rho20 = wireMaterial === 'Copper' ? 0.0178 : 0.0282;
  const T_wire = roofCtemp; 
  const rho_T = rho20 * (1 + 0.00404 * (T_wire - 20));
  const dV = (2 * wireLength * iSc * rho_T) / wireArea;
  const dVPercent = (dV / totalStringVocCold) * 100;
  
  results.rule12 = {
    compliant: dVPercent <= 2.0, 
    val: dVPercent.toFixed(2),
    unit: '%',
    formula: 'rho(T) = rho20 * (1 + 0.00404*(T-20)); dV_percent = (2*L*I*rho(T)/Area)/V_string',
    subs: `rho(${T_wire.toFixed(0)}°C) = ${rho20} * (1 + 0.00404*(${T_wire.toFixed(0)}-20)) = ${rho_T.toFixed(5)}. dV = 2 * ${wireLength}m * ${iSc}A * ${rho_T.toFixed(5)} / ${wireArea}mm² = ${dV.toFixed(2)}V (${dVPercent.toFixed(2)}%)`,
    note: dVPercent > 2.0
      ? `Warning: Voltage drop is too high (${dVPercent.toFixed(2)}% > 2.0%). Leads to yield losses. Increase wire area or shorten path.`
      : `Voltage drop is optimal: ${dVPercent.toFixed(2)}% (Limit: 2.0%).`
  };

  // Rule 13: SPD Sizing (IEC 61643)
  const U_cpv_req = 1.2 * totalStringVocCold;
  const dualSpdNeeded = wireLength > 10;
  const groundingOk = groundingLength <= 50;
  
  const isSpdTypeCorrect = isRoofMounted ? spdType === 'Type 2' : spdType === 'Type 1';
  const spdCompliant = hasSPD && groundingOk && isSpdTypeCorrect && !dualSpdNeeded;
  
  let spdMsg;
  if (!hasSPD) {
    spdMsg = 'CRITICAL: Surge Protection Device (SPD) is missing! Danger of strike damage.';
  } else if (!groundingOk) {
    spdMsg = `Warning: SPD grounding wire length (${groundingLength}cm) exceeds 50cm. High inductance compromises surge damping. Shorten it!`;
  } else if (!isSpdTypeCorrect) {
    spdMsg = isRoofMounted
      ? `Warning: Roof-mounted PV systems require Type 2 SPD. Current type is ${spdType}.`
      : `Warning: Ground-mounted PV systems require Type 1 SPD. Current type is ${spdType}.`;
  } else if (dualSpdNeeded) {
    spdMsg = `Warning: Cable length is ${wireLength}m (>10m). Dual SPDs are required (one at panels, one at inverter) to satisfy safety regulations.`;
  } else {
    spdMsg = `Compliant. Grounding wire length is ${groundingLength}cm. SPD type: ${spdType}.`;
  }

  results.rule13 = {
    compliant: spdCompliant,
    val: U_cpv_req.toFixed(0),
    unit: 'V',
    formula: 'Ucpv >= 1.2 * Voc_cold_string; Type matches mounting (Roof=Type 2, Ground=Type 1); dual SPDs if wire > 10m',
    subs: `Ucpv_min = 1.2 * ${totalStringVocCold.toFixed(0)}V = ${U_cpv_req.toFixed(0)}V. Wire Length = ${wireLength}m, Grounding wire = ${groundingLength}cm, SPD Type = ${spdType}`,
    note: spdMsg
  };

  // Rule 14: RCD Type B (Mandatory for transformerless inverters)
  const rcdCompliant = rcdType === 'Type B';
  results.rule14 = {
    compliant: rcdCompliant,
    val: rcdType,
    unit: '',
    formula: 'Inverter leakage protection == Type B (Hall-effect)',
    subs: `Selected RCD: ${rcdType}`,
    note: rcdCompliant 
      ? 'Compliant: Type B RCD correctly handles smooth DC leakages (>6mA) without blinding.'
      : 'CRITICAL SAFETY VIOLATION: Transformerless inverters leak DC current. Standard RCD is blinded and will fail to trip! Type B required.'
  };

  // Rule 15: RCD Cascade Rule
  const cascadeCompliant = rcdType !== 'Type B' || upstreamRcdType === 'Type B';
  results.rule15 = {
    compliant: cascadeCompliant,
    val: upstreamRcdType,
    unit: '',
    formula: 'If downstream = Type B RCD, upstream must = Type B',
    subs: `Downstream: ${rcdType}, Upstream: ${upstreamRcdType}`,
    note: cascadeCompliant
      ? 'Compliant: Upstream RCD is safe from blinding.'
      : 'CRITICAL VIOLATION: Upstream building RCD is not Type B. It will be BLINDED and fail to protect the main building! Upgrade upstream RCD.'
  };

  // -------------------------------------------------------------
  // BLOCK IV: INVERTERS & MECHANICS (Rules 16-22)
  // -------------------------------------------------------------

  // Rule 16: Inverter Derating (Ambient Temp > 25°C)
  let deratingPercent = 0;
  if (tAmbient > 25) {
    deratingPercent = (tAmbient - 25) * 1.0; 
  }
  const maxInverterOutput = inverterRating * (1 - deratingPercent / 100);
  results.rule16 = {
    compliant: deratingPercent < 25,
    val: maxInverterOutput.toFixed(2),
    unit: 'kW',
    formula: 'Pmax_inverter = Pinverter_STC * (1 - 0.01 * max(0, Tambient - 25))',
    subs: `Pmax = ${inverterRating} * (1 - 0.01 * max(0, ${tAmbient} - 25)) = ${maxInverterOutput.toFixed(2)} kW`,
    note: deratingPercent > 0 
      ? `Inverter is hot. Power capability reduced by ${deratingPercent.toFixed(0)}% due to thermal derating.`
      : 'No thermal derating (ambient temp ≤ 25°C).'
  };

  // Rule 17: MPPT vs PWM
  // systemPowerKW is calculated dynamically at the top
  const isPWMInvalid = mpptType === 'PWM' && systemPowerKW > 2.0;
  results.rule17 = {
    compliant: !isPWMInvalid,
    val: mpptType,
    unit: '',
    formula: 'If P_system > 2kW, controller must be MPPT',
    subs: `System Power = ${systemPowerKW.toFixed(2)} kW. Controller type: ${mpptType}`,
    note: isPWMInvalid 
      ? 'Warning: PWM controller selected for high power system (>2kW). Yield losses up to 30%! Switch to MPPT.'
      : 'Compliant: MPPT tracking ensures optimal power extraction.'
  };

  // Rule 18: Wind Sizing (ASCE 7-16)
  const q_h = 0.000613 * Math.pow(windSpeed, 2);
  const G_gust = 0.85; 
  const C_f = pitchAngle === 90 ? 2.0 : 1.3; 
  const windPressure = q_h * G_gust * C_f; 
  
  const Cp = 1.5;
  const SF = 1.5;
  const ballastWeightKg = panelArea * q_h * Cp * SF * 100; 
  
  results.rule18 = {
    compliant: true,
    val: ballastWeightKg.toFixed(0),
    unit: 'kg',
    formula: 'p = qh * G * Cf; Ballast = Area * qh * Cp * SF',
    subs: `qh = 0.000613 * ${windSpeed}² = ${q_h.toFixed(3)} kPa. Ballast = ${panelArea}m² * ${q_h.toFixed(3)} kPa * 1.5 * 1.5 * 100 kg/kN = ${ballastWeightKg.toFixed(0)} kg`,
    note: `Wind load pressure: ${windPressure.toFixed(3)} kPa. Required flat-roof ballast weight: ${ballastWeightKg.toFixed(0)} kg.`
  };

  // Rule 19: Battery Sizing (DOD impact)
  const dod = BATTERY_TYPES[batteryType] ? BATTERY_TYPES[batteryType].dod : 0.90;
  const inverterEff = 0.95;
  const E_bat_req = (criticalLoad * daysOfAutonomy) / (dod * inverterEff);
  results.rule19 = {
    compliant: true,
    val: E_bat_req.toFixed(2),
    unit: 'kWh',
    formula: 'Ebat = (Wcritical * Ndays) / (DOD * ηinverter)',
    subs: `Ebat = (${criticalLoad} * ${daysOfAutonomy}) / (${dod} * ${inverterEff}) = ${E_bat_req.toFixed(2)} kWh`,
    note: `Chemistry: ${batteryType} (DOD: ${(dod*100).toFixed(0)}%). Higher DOD lowers initial battery cost.`
  };

  // Rule 20: BMS Balancing
  const activeBmsReq = batteryCapacity >= 100;
  const bmsCompliant = !activeBmsReq || bmsType === 'Active';
  results.rule20 = {
    compliant: bmsCompliant,
    val: bmsType,
    unit: '',
    formula: 'If Battery_Capacity >= 100Ah, BMS must be Active',
    subs: `Capacity = ${batteryCapacity} Ah. BMS Type: ${bmsType}`,
    note: !bmsCompliant
      ? 'Warning: Passive BMS on a large capacity battery (>100Ah) burns excessive cell energy as heat. Upgrade to Active BMS.'
      : 'Compliant: Active balancing prevents thermal drift and extends battery life.'
  };

  // Rule 21: Sodium-Ion low temperature
  const naIonWarning = tLowest < -20 && batteryType !== 'Na-Ion';
  results.rule21 = {
    compliant: true,
    val: batteryType,
    unit: '',
    formula: 'LowTempOperation(Na-Ion) down to -40°C',
    subs: `Lowest Temp = ${tLowest}°C. Selected battery: ${batteryType}`,
    note: naIonWarning
      ? `Warning: Ambient temp falls to ${tLowest}°C. Lithium/GEL batteries lose charge capacity. Sodium-Ion (Na-Ion) is recommended for extreme cold.`
      : 'Sodium-Ion or acceptable thermal climate selected.'
  };

  // Rule 22: EV Sizing (V2H) and Generator contacts
  const runGenerator = batterySOC < 20 && hasDryContact;
  let reserveNote;
  let reserveCompliant = true;
  if (batterySOC < 20) {
    if (hasDryContact) {
      reserveNote = 'Alert: Battery SOC < 20%. Dry contact triggered. Backup generator initiated.';
    } else {
      reserveNote = 'Warning: Battery SOC < 20% and no dry contact available to trigger backup generator!';
      reserveCompliant = false; // Make sure the rule fails compliance if emergency and no backup trigger!
    }
  } else {
    reserveNote = 'System reserve is stable. EV V2H and backup generator standing by.';
  }

  results.rule22 = {
    compliant: reserveCompliant,
    val: runGenerator ? 'Gen ON' : 'Gen OFF',
    unit: '',
    formula: 'DryContact_Trigger = (SOC < 20%)',
    subs: `SOC = ${batterySOC}%, Dry Contact: ${hasDryContact ? 'Connected' : 'Missing'}`,
    note: reserveNote
  };

  // -------------------------------------------------------------
  // BLOCK V: MACROECONOMICS, ESG & AI (Rules 23-30)
  // -------------------------------------------------------------

  // Rule 23: Zero Export Controller
  const generatedSolarPower = (actualPanelPowerBifacial * panelsPerString) / 1000; 
  const exportPower = generatedSolarPower - loadPower;
  let pInverterLimit = generatedSolarPower;
  if (zeroExportEnabled && exportPower > gridTarget) {
    pInverterLimit = Math.max(0, loadPower - gridTarget);
  }
  results.rule23 = {
    compliant: true,
    val: pInverterLimit.toFixed(2),
    unit: 'kW',
    formula: 'Pinverter_limit = Pload - Pgrid_target',
    subs: `Solar Gen = ${generatedSolarPower.toFixed(2)} kW, Load = ${loadPower} kW. Inverter setpoint: ${pInverterLimit.toFixed(2)} kW`,
    note: zeroExportEnabled
      ? `Zero-Export controller restricts inverter output to ${pInverterLimit.toFixed(2)} kW to avoid grid feed-in penalties.`
      : 'Grid feeding allowed. Zero-Export is disabled.'
  };

  // Rule 24: Thermal Alternative (Excess Solar to Heat Pump)
  const excessSolar = Math.max(0, exportPower);
  const heatPumpCOP = 3.5;
  const thermalPowerOut = excessSolar * heatPumpCOP;
  results.rule24 = {
    compliant: true,
    val: thermalPowerOut.toFixed(2),
    unit: 'kWth',
    formula: 'Pthermal = Pexcess * COP',
    subs: `Excess Solar = ${excessSolar.toFixed(2)} kW. Heat Pump output: ${thermalPowerOut.toFixed(2)} kW thermal`,
    note: hasHeatPump && excessSolar > 0
      ? `Diverting ${excessSolar.toFixed(2)} kW surplus solar power to Heat Pump (COP = 3.5) generating ${thermalPowerOut.toFixed(2)} kW of hot water/underfloor heat.`
      : 'No surplus diversion active (no surplus or Heat Pump not selected).'
  };

  // Rule 25: Long-term Degradation (LID)
  const yearIndex = operationYears;
  const remainingFraction = (1 - lidFactor / 100) * Math.pow(1 - annualDegradation / 100, yearIndex - 1);
  const remainingPower = systemPowerKW * remainingFraction;
  results.rule25 = {
    compliant: remainingFraction > 0.70, 
    val: (remainingFraction * 100).toFixed(1),
    unit: '%',
    formula: 'Pn = P0 * (1 - LID) * (1 - d)^(n-1)',
    subs: `P_year_${yearIndex} = ${systemPowerKW.toFixed(2)}kW * (1 - ${lidFactor/100}) * (1 - ${annualDegradation/100})^(${yearIndex}-1) = ${remainingPower.toFixed(2)} kW`,
    note: `Panel yield in year ${yearIndex} will degrade to ${(remainingFraction * 100).toFixed(1)}% of original rating.`
  };

  // Rule 26: ROI & LCOE
  let cumulativeSavings = 0;
  for (let yr = 1; yr <= operationYears; yr++) {
    const inflatedTariffRetail = tariffRetail * Math.pow(1 + inflationRate / 100, yr);
    const inflatedTariffFeed = tariffFeedIn * Math.pow(1 + inflationRate / 100, yr);
    const yearlyDegradationFactor = (1 - lidFactor / 100) * Math.pow(1 - annualDegradation / 100, yr - 1);
    
    const yrDirect = eDirectYearly * yearlyDegradationFactor;
    const yrExport = eExportYearly * yearlyDegradationFactor;
    
    const yrOpex = opexYearly * Math.pow(1 + inflationRate / 100, yr - 1);
    const yrSavings = (yrDirect * inflatedTariffRetail) + (yrExport * inflatedTariffFeed) - yrOpex;
    cumulativeSavings += yrSavings;
  }
  
  const initialCapex = systemPowerKW * 1200 + E_bat_req * 300; 
  const roiPercent = initialCapex > 0 ? ((cumulativeSavings - initialCapex) / initialCapex) * 100 : 0;
  
  results.rule26 = {
    compliant: roiPercent > 100,
    val: roiPercent.toFixed(0),
    unit: '%',
    formula: 'Savings = Sum( (E_dir*T_ret + E_exp*T_feed)*(1+i)^y - OPEX )',
    subs: `CAPEX ≈ $${initialCapex.toFixed(0)}. Cumulative Savings (${operationYears} yrs) = $${cumulativeSavings.toFixed(0)}. Net Return: ${roiPercent.toFixed(0)}%`,
    note: `Payback period estimated: ${(initialCapex / (cumulativeSavings / operationYears)).toFixed(1)} years.`
  };

  // Rule 27: Environmental & ESG (The central "Equivalent" generator)
  // totalGenYearly is calculated dynamically at the top
  const annualCO2SavedKg = totalGenYearly * gridEmissionFactor; 
  const lifetimeCO2SavedTons = (annualCO2SavedKg * operationYears) / 1000; 
  
  const forestHectares = (lifetimeCO2SavedTons / (6.0 * operationYears));
  const replacedCarsYears = lifetimeCO2SavedTons / 4.6;
  const totalTreesPlanted = Math.round(annualCO2SavedKg / 22);
  const avoidedCoalTons = lifetimeCO2SavedTons * 0.41;

  results.rule27 = {
    compliant: lifetimeCO2SavedTons > 0,
    val: lifetimeCO2SavedTons.toFixed(1),
    unit: 't CO2',
    formula: 'CO2_saved = E_gen * EF_grid',
    subs: `CO2 = (${totalGenYearly} kWh * ${gridEmissionFactor} kg/kWh * ${operationYears} yrs) / 1000 = ${lifetimeCO2SavedTons.toFixed(1)} tons`,
    equivalents: {
      co2: lifetimeCO2SavedTons.toFixed(1),
      forest: forestHectares.toFixed(2),
      cars: replacedCarsYears.toFixed(1),
      trees: totalTreesPlanted,
      coal: avoidedCoalTons.toFixed(1)
    },
    note: `Environmental impact: Equivalent to planting ${totalTreesPlanted} trees or taking ${replacedCarsYears.toFixed(1)} gasoline cars off the road.`
  };

  // Rule 28: AI load profile clustering
  const peakLoadEstim = occupantsCount * 0.8 + (houseArea * 0.015); 
  results.rule28 = {
    compliant: true,
    val: peakLoadEstim.toFixed(2),
    unit: 'kW',
    formula: 'PeakLoad_est = occupants * 0.8kW + area * 0.015kW/m²',
    subs: `Peak = ${occupantsCount} * 0.8 + ${houseArea} * 0.015 = ${peakLoadEstim.toFixed(2)} kW`,
    note: 'AI Load Profiling uses clustering models to match household area and occupancy to synthetic load curves.'
  };

  // Rule 29: AI Peak Shaving (MPC)
  const isPeakShavingActive = hasV2H && batteryCapacity > 100;
  results.rule29 = {
    compliant: true,
    val: isPeakShavingActive ? 'Active' : 'Disabled',
    unit: '',
    formula: 'MPC_PeakShaving = (hasV2H && Battery_Capacity > 100Ah)',
    subs: `V2H: ${hasV2H ? 'Connected' : 'N/A'}, Battery: ${batteryCapacity}Ah`,
    note: isPeakShavingActive
      ? 'AI Model Predictive Control (MPC) shaving peaks active: Batteries discharge in advance of peak-tariff grid hours.'
      : 'Peak shaving inactive. Requires active V2H connection and >100Ah battery storage.'
  };

  // Rule 30: CV and SLD Export
  const angleError = Math.abs(roofPitchSlider - pitchAngle);
  const cvAligned = angleError <= 2.0;
  results.rule30 = {
    compliant: cvAligned,
    val: roofPitchSlider,
    unit: '°',
    formula: 'CV_Estimate ≈ Design_Pitch (Tolerance ± 2°)',
    subs: `Camera Pitch = ${roofPitchSlider}°, Sized Pitch = ${pitchAngle}° (Diff = ${angleError.toFixed(1)}°)`,
    note: cvAligned
      ? 'Computer Vision matches drawing angle. SLD schematic is ready for canvas rendering.'
      : 'Warning: Computer Vision pitch estimate differs from manual design. Re-align panels to roof structure!'
  };

  return {
    inputs,
    results
  };
}
