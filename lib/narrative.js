// Motor de narrativa Agropulse.
//
// Compone el informe en lenguaje natural en tres movimientos:
//   1) Hallazgo técnico  (qué muestran los datos)
//   2) Interpretación agronómica  (qué significa a campo)
//   3) Sugerencia de manejo  (qué hacer)
//
// Usa bancos de sinónimos + conectores + un PRNG sembrado por
// (lat, lon, fecha_imagen) para producir redacciones únicas por lote,
// deterministas frente al mismo análisis y variadas entre sí. El tono
// emula al de un perito agrónomo senior: preciso, sobrio, sin coloquialismos.

// ---------------------------------------------------------------------------
// PRNG sembrado (mulberry32) + hash FNV-1a
// ---------------------------------------------------------------------------

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makePicker(seed) {
  const rng = mulberry32(seed);
  const used = new Set();
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  // Evita repetir conectores consecutivos.
  const pickUnique = (arr, key = 'default') => {
    for (let i = 0; i < 12; i++) {
      const v = arr[Math.floor(rng() * arr.length)];
      const tag = `${key}::${v}`;
      if (!used.has(tag)) { used.add(tag); return v; }
    }
    return pick(arr);
  };
  return { rng, pick, pickUnique };
}

// ---------------------------------------------------------------------------
// Bancos de frases (tono perito agrónomo senior)
// ---------------------------------------------------------------------------

const OPENERS = [
  'Del último análisis satelital disponible se desprende que',
  'La lectura satelital más reciente permite establecer que',
  'A partir del procesamiento multiespectral Sentinel-2 se observa que',
  'De acuerdo con la interpretación de las imágenes disponibles,',
  'Conforme al monitoreo orbital vigente,',
  'El diagnóstico por sensores remotos indica que',
  'Surge del último paso orbital procesado que',
  'La evidencia teledetectada sobre el lote permite inferir que',
];

// Descriptores del hallazgo por rango de anomalía NDVI.
const FINDINGS = {
  sequia_alerta: [
    'el índice NDVI registra una depresión severa de {anom} respecto del promedio histórico del mismo mes',
    'el vigor fotosintético presenta una contracción marcada ({anom} vs. referencia histórica quinquenal)',
    'se detecta una caída pronunciada del NDVI en el orden del {anomAbs}',
    'el vigor de la cobertura vegetal cede {anomAbs} frente a la media de las últimas cinco campañas',
    'la biomasa verde activa exhibe un retroceso significativo ({anom}) en relación a la climatología local',
    'los valores de NDVI acusan una pérdida de expresión vegetal del {anomAbs}',
  ],
  estres_hidrico_plaga: [
    'el NDVI muestra un desvío negativo de {anom} respecto del promedio histórico',
    'el vigor vegetal se ubica por debajo del rango esperable (diferencia {anom})',
    'la firma espectral sugiere una pérdida de vigor del {anomAbs} frente a la referencia histórica',
    'se registra un deterioro moderado del índice NDVI ({anom}) respecto del patrón esperado',
    'la actividad fotosintética está {anomAbs} por debajo de la referencia histórica del mismo período',
  ],
  observacion: [
    'el NDVI se sitúa levemente por debajo del promedio histórico ({anom})',
    'se observa un ligero rezago del vigor vegetal ({anom}) respecto del patrón habitual',
    'la expresión vegetal cede de forma moderada ({anomAbs}) frente a la referencia del mismo mes',
    'aparece un desvío negativo contenido del índice ({anom}) en relación al histórico',
  ],
  normal: [
    'el NDVI se encuentra dentro de los rangos históricos esperados ({anom})',
    'los valores de NDVI convergen con el patrón histórico ({anom})',
    'la expresión vegetal es consistente con el comportamiento habitual del lote para esta época',
    'el vigor fotosintético se ubica en línea con la referencia quinquenal ({anom})',
  ],
  optimo: [
    'el NDVI supera al promedio histórico en {anomAbs}',
    'el vigor vegetal exhibe un desempeño destacado, {anomAbs} por encima de la referencia quinquenal',
    'se registra una sobre-expresión de biomasa verde del {anomAbs} frente al histórico',
    'los valores de NDVI superan al patrón habitual en {anomAbs}',
  ],
  cuerpo_de_agua: [
    'la firma espectral es compatible con un cuerpo de agua y no con cobertura vegetal productiva',
  ],
  sin_datos: [
    'los datos disponibles no son suficientes para establecer un diagnóstico confiable',
  ],
};

// Interpretación agronómica por status + etapa fenológica.
const INTERPRETATIONS = {
  sequia_alerta: {
    barbecho: [
      'lo cual es consistente con suelo desnudo sometido a evaporación sostenida',
      'compatible con una superficie sin cobertura vegetal activa y exposición directa',
    ],
    emergencia: [
      'cuadro compatible con estrés hídrico en implantación y posible pérdida de plantas por stand reducido',
      'situación consistente con deficiencias de agua durante la emergencia, con riesgo de resiembra parcial',
    ],
    crecimiento: [
      'consistente con déficit hídrico prolongado y una posible limitación de nitrógeno disponible',
      'compatible con un cuadro de estrés por agua con probable afectación de la tasa de acumulación de biomasa',
    ],
    pleno_desarrollo: [
      'cuadro consistente con estrés hídrico severo en período crítico, con riesgo de caída de rendimiento',
      'compatible con un déficit hídrico pronunciado en un momento altamente sensible del cultivo',
    ],
    maximo_vigor: [
      'consistente con un estrés hídrico agudo sobre cultivo en máxima demanda, con impacto potencial sobre el rinde',
    ],
    senescencia: [
      'compatible con un cierre de ciclo anticipado o con estrés terminal de campaña',
      'consistente con una senescencia forzada por falta de agua o con agotamiento fisiológico temprano',
    ],
  },
  estres_hidrico_plaga: {
    _default: [
      'cuadro compatible con estrés hídrico incipiente o con presión biótica (insectos, malezas o patógenos foliares)',
      'situación atribuible a un déficit hídrico moderado, a competencia por malezas o a una incidencia inicial de plagas',
      'compatible con una combinación de déficit hídrico y eventual presión sanitaria aún no confirmada',
    ],
  },
  observacion: {
    _default: [
      'atribuible a variaciones de manejo, heterogeneidad de suelos o microclima reciente',
      'asociable a diferencias de fecha de siembra, dosis de fertilización o eventos climáticos puntuales',
      'explicable por variabilidad normal entre ambientes del lote',
    ],
  },
  normal: {
    _default: [
      'lo que indica un comportamiento del cultivo dentro de lo esperado para el ambiente y la fecha',
      'signo de una dinámica productiva alineada con el patrón histórico del establecimiento',
    ],
  },
  optimo: {
    _default: [
      'asociable a una campaña con expresión vegetativa favorable y recursos hídricos adecuados',
      'compatible con una combinación positiva de manejo nutricional y disponibilidad de agua',
      'consistente con un escenario productivo por encima de la media histórica del ambiente',
    ],
  },
  cuerpo_de_agua: {
    _default: [
      'por lo que no corresponde aplicar métricas agronómicas estándar sobre esta geometría',
    ],
  },
  sin_datos: {
    _default: [
      'por lo que se sugiere repetir el análisis una vez disponible una ventana satelital despejada',
    ],
  },
};

// Moduladores por NDWI (humedad).
const WATER_MODS = {
  dry: [
    ', en un contexto de déficit de humedad superficial',
    ', con un NDWI que confirma limitaciones de agua a nivel de canopeo',
    ', acompañado por señales de baja disponibilidad de humedad foliar',
  ],
  wet: [
    ', en un contexto de humedad superficial adecuada',
    ', con un NDWI compatible con buena disponibilidad de agua en el canopeo',
  ],
  neutral: [''],
};

const CONNECTORS = [
  'Asimismo,', 'En paralelo,', 'Complementariamente,', 'A su vez,',
  'En el mismo sentido,', 'Por su parte,', 'Adicionalmente,',
];

// Cláusulas sobre ranking histórico.
const RANKING_PHRASES = {
  top_10: [
    'el lote se ubica en el percentil {P} del quinquenio, calificando entre las mejores campañas del registro reciente',
    'dentro del registro quinquenal, la campaña se posiciona en el tramo superior (P{P})',
  ],
  top_25: [
    'el percentil histórico alcanza P{P}, por encima del 75 % de los años registrados',
    'el lote se ubica entre los valores altos de la serie histórica (P{P})',
  ],
  sobre_mediana: [
    'el NDVI queda en el percentil {P}, ligeramente sobre la mediana histórica',
    'la posición relativa (P{P}) es algo superior al valor medio de los últimos cinco años',
  ],
  bajo_mediana: [
    'el lote se sitúa en el percentil {P}, por debajo de la mediana histórica',
    'la posición relativa (P{P}) queda por debajo del valor medio quinquenal',
  ],
  bottom_25: [
    'la campaña se ubica entre las peores del registro reciente (P{P})',
    'el lote queda en el cuartil inferior histórico (P{P}), lejos de los mejores años',
  ],
};

// Cláusula comparativa zonal.
const BENCHMARK_PHRASES = {
  above: [
    'el vigor del lote supera en {deltaAbs} a la media de un radio de 10 km',
    'el establecimiento rinde {deltaAbs} por encima del promedio zonal en un radio de 10 km',
  ],
  below: [
    'el vigor del lote queda {deltaAbs} por debajo del promedio zonal (radio 10 km)',
    'el NDVI se posiciona {deltaAbs} por debajo de los valores medios del entorno de 10 km',
  ],
  aligned: [
    'el vigor del lote se alinea con la media zonal en un radio de 10 km',
    'los valores se encuentran en línea con el promedio del entorno inmediato',
  ],
};

// Cláusula interanual (YoY) — siempre presente si hay dato.
const YOY_PHRASES = {
  above: [
    'En la comparación interanual, el NDVI se ubica {deltaAbs} por encima del mismo mes del año anterior',
    'Respecto del ciclo previo, el vigor vegetal mejora en {deltaAbs} para el mismo período',
  ],
  below: [
    'En términos interanuales, el NDVI cede {deltaAbs} frente al mismo mes del año anterior',
    'Respecto del ciclo previo, se observa una retracción de {deltaAbs} en el vigor vegetal',
  ],
  aligned: [
    'En la lectura interanual, el NDVI se mantiene en línea con el valor del mismo mes del año anterior',
    'Respecto del ciclo previo no se observan diferencias significativas para el mismo período',
  ],
  nodata: [],
};

// Cláusula de estrés hídrico (días NDWI bajo umbral).
const STRESS_PHRASES = [
  'Adicionalmente, el NDWI permanece por debajo del umbral crítico desde hace {days} días, lo que indica un déficit de humedad superficial sostenido',
  'En paralelo, se contabilizan {days} días con NDWI por debajo del umbral, señal de estrés hídrico acumulado',
  'El registro de NDWI acumula {days} días consecutivos por debajo del umbral, consistente con un escenario de agua limitante',
];

// Sugerencia de manejo por status / modo.
const ACTIONS = {
  sequia_alerta: [
    'Se sugiere activar protocolo de sequía, priorizar muestreo de humedad edáfica en sectores críticos y diferir dosis altas de fertilizante hasta recuperar condiciones',
    'Corresponde evaluar riego complementario donde sea técnica y económicamente viable, realizar muestreo dirigido y reprogramar aplicaciones de alta dosis',
    'Se recomienda priorizar recorrida agronómica a campo, instrumentar muestreo de humedad de suelo y diferir decisiones de refertilización mientras persista el cuadro',
  ],
  estres_hidrico_plaga: [
    'Se aconseja realizar una recorrida dirigida para descartar plaga o patógeno, complementada con análisis foliar si los síntomas persisten',
    'Corresponde confirmar a campo la causa del desvío (hídrica o biótica) y, en paralelo, evaluar el estado nutricional mediante análisis foliar',
    'Se sugiere inspección agronómica dirigida con muestreo foliar y de suelo, a fin de discriminar entre estrés hídrico y presión sanitaria',
  ],
  observacion: [
    'Se recomienda mantener monitoreo semanal y contrastar contra el mapa de ambientes del lote',
    'Resulta conveniente sostener el seguimiento satelital periódico y documentar diferencias en recorridas de campo',
    'Se aconseja incrementar la frecuencia de observación hasta confirmar la evolución del cuadro',
  ],
  normal: [
    'Se recomienda continuar con el protocolo de monitoreo estándar y registrar evolución en próximas pasadas orbitales',
    'Corresponde sostener el manejo planificado, contrastando con el histórico del lote en cada nueva captura',
  ],
  optimo: [
    'Resulta conveniente capitalizar las condiciones favorables ajustando la estrategia de nutrición y protección sanitaria',
    'Se sugiere optimizar planes de fertilización y manejo fitosanitario para sostener el desempeño observado',
  ],
  cuerpo_de_agua: [
    'Se sugiere verificar la geometría seleccionada y reasignar el análisis a una superficie productiva',
  ],
  sin_datos: [
    'Se recomienda repetir el análisis una vez disponible una ventana satelital despejada',
  ],
};

// Cierres según modo de reporte.
const CLOSINGS = {
  alerta_roja: [
    'Dada la magnitud del desvío, se sugiere visita de campo dentro de las próximas 48 horas y activación del protocolo de contingencia.',
    'La severidad del cuadro amerita intervención agronómica inmediata y un seguimiento satelital de alta frecuencia hasta su reversión.',
    'Frente a la gravedad de la anomalía, se impone una evaluación a campo de carácter urgente y la revisión del plan de manejo vigente.',
  ],
  pre_cosecha: [
    'Se recomienda coordinar con el responsable de cosecha el monitoreo de humedad de grano y ajustar la logística de acopio.',
    'Corresponde iniciar la planificación fina de cosecha: control de humedad de grano, logística de tolvas y ventanas de trilla.',
    'Resulta oportuno afinar el cronograma de cosecha y verificar la disponibilidad de estructura de acopio acorde al volumen proyectado.',
  ],
  estandar: [
    'Se aconseja sostener el monitoreo satelital semanal y complementar con recorridas programadas a campo.',
    'Corresponde mantener el seguimiento periódico y registrar la evolución en las próximas capturas orbitales.',
    'Se recomienda continuar con el protocolo de observación habitual y contrastar los hallazgos con información de campo.',
  ],
};

// ---------------------------------------------------------------------------
// Detección del modo de reporte
// ---------------------------------------------------------------------------

export function detectReportMode(ctx) {
  const a = ctx?.anomalies?.ndvi;
  if (a != null && a <= -25) return 'alerta_roja';
  const stage = ctx?.phenology?.stage;
  const trend = ctx?.phenology?.trend;
  if (stage === 'senescencia' && trend !== 'subiendo') return 'pre_cosecha';
  return 'estandar';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtPct(v, { signed = true, abs = false } = {}) {
  if (v == null || !Number.isFinite(v)) return '—';
  const n = abs ? Math.abs(v) : v;
  const s = signed && !abs && v > 0 ? '+' : '';
  return `${s}${n.toFixed(1)} %`;
}

function fillPlaceholders(s, vars) {
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '—' : String(vars[k])));
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------------------------------------------------------------------------
// Composición
// ---------------------------------------------------------------------------

export function buildNarrative(ctx) {
  const {
    status, anomalies, phenology, ranking, benchmark, yoy,
    stressDays, landCover, geometry, current,
  } = ctx;

  // Semilla determinista por lote + fecha de imagen
  const lat = geometry?.center?.lat ?? 0;
  const lon = geometry?.center?.lon ?? 0;
  const seedStr = `${lat.toFixed(5)}|${lon.toFixed(5)}|${current?.date || ''}|${status}`;
  const { pick, pickUnique } = makePicker(fnv1a(seedStr));

  const mode = detectReportMode(ctx);

  // Landcover especial: cuerpo de agua
  if (landCover === 'agua') {
    const opener = pick(OPENERS);
    const finding = pick(FINDINGS.cuerpo_de_agua);
    const interp = pick(INTERPRETATIONS.cuerpo_de_agua._default);
    const action = pick(ACTIONS.cuerpo_de_agua);
    return {
      mode,
      text: `${opener} ${finding}, ${interp}. ${action}.`,
      sections: { finding, interpretation: interp, action },
      seed: seedStr,
    };
  }

  const vars = {
    anom: fmtPct(anomalies?.ndvi),
    anomAbs: fmtPct(anomalies?.ndvi, { abs: true }),
    P: ranking?.percentile ?? '—',
    deltaAbs: fmtPct(benchmark?.delta, { abs: true }),
    yoyDeltaAbs: fmtPct(yoy?.delta, { abs: true }),
    days: stressDays?.days ?? '—',
  };

  // ---- 1) Hallazgo técnico ----
  const findingBank = FINDINGS[status] || FINDINGS.normal;
  const findingRaw = pick(findingBank);
  const waterMod =
    anomalies?.ndwi == null ? pick(WATER_MODS.neutral)
    : anomalies.ndwi <= -10 ? pick(WATER_MODS.dry)
    : anomalies.ndwi >= 10 ? pick(WATER_MODS.wet)
    : pick(WATER_MODS.neutral);
  const finding = fillPlaceholders(findingRaw, vars) + waterMod;

  // ---- 2) Interpretación agronómica ----
  const interpBank =
    INTERPRETATIONS[status]?.[phenology?.stage] ||
    INTERPRETATIONS[status]?._default ||
    INTERPRETATIONS.normal._default;
  const interpretation = pick(interpBank);

  // ---- 3) Contexto cuantitativo (ranking, benchmark, YoY, estrés) ----
  const contextClauses = [];
  if (ranking?.bucket && RANKING_PHRASES[ranking.bucket]) {
    contextClauses.push(fillPlaceholders(pick(RANKING_PHRASES[ranking.bucket]), vars));
  }
  if (benchmark?.delta != null) {
    const bKey = Math.abs(benchmark.delta) < 3 ? 'aligned' : benchmark.delta > 0 ? 'above' : 'below';
    contextClauses.push(fillPlaceholders(pick(BENCHMARK_PHRASES[bKey]), vars));
  }
  if (yoy?.delta != null) {
    const yKey = Math.abs(yoy.delta) < 3 ? 'aligned' : yoy.delta > 0 ? 'above' : 'below';
    contextClauses.push(fillPlaceholders(pick(YOY_PHRASES[yKey]), vars));
  }
  if (stressDays?.days != null && stressDays.days >= 7) {
    contextClauses.push(fillPlaceholders(pick(STRESS_PHRASES), vars));
  }

  // ---- 4) Sugerencia de manejo ----
  const actionBank = ACTIONS[status] || ACTIONS.normal;
  let action = pick(actionBank);
  if (mode === 'pre_cosecha') {
    action = 'Dado que el cultivo ingresa en senescencia, ' +
      'se sugiere adelantar la planificación de cosecha, verificar humedad de grano y organizar la logística de acopio';
  }

  // ---- 5) Cierre según modo ----
  const closing = pick(CLOSINGS[mode] || CLOSINGS.estandar);

  // ---- Ensamble con conectores sin repetición inmediata ----
  const opener = pick(OPENERS);
  const first = `${opener} ${finding}, ${interpretation}.`;

  const contextSentences = contextClauses.map((c, i) => {
    // La primera cláusula del contexto inicia con un conector; las siguientes alternan.
    const conn = pickUnique(CONNECTORS, `conn-${i}`);
    return `${conn} ${c}.`;
  });

  const actionSentence = `${capitalize(action)}.`;

  const paragraph = [first, ...contextSentences, actionSentence, closing].join(' ');

  return {
    mode,
    text: paragraph,
    sections: {
      opener,
      finding,
      interpretation,
      context: contextClauses,
      action,
      closing,
    },
    seed: seedStr,
  };
}
