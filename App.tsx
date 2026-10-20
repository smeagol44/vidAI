// tslint:disable
/* eslint-disable */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Play,
  Pause,
  RotateCw,
  Zap,
  Info,
  Menu,
  X,
  Volume2,
  VolumeX,
  Compass,
  Activity,
  Plus,
  Sparkles,
  Sliders,
  Layers,
  Dna,
  Gauge,
  Network,
  AlertTriangle,
  Flame,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  GripHorizontal,
  Download,
  Upload,
  Save,
  FolderOpen,
  Swords,
  GitBranch,
  Settings as SettingsIcon,
  RefreshCw,
  Eye,
  Footprints,
  Clock,
  Split,
  FastForward,
} from 'lucide-react';
import {getConfig} from './constants';
import BackgroundMusic from './utils/BackgroundMusic';
import BrainGraph from './BrainGraph';
import {runProductionChecks} from './diagnostics';
import CreaturePreview from './CreaturePreview';
import {createInitialWorld, addExternalOrganism, collectWorldStats} from './world';
import {
  createFixedStepper,
  drawAsset,
  GameState,
  MenuOverlay,
  Overlay,
  prepareCanvas,
  useAssets,
  useIsMobile,
  gameAudio,
} from './utils/helper';
import neuralNodeIconUrl from './assets/images/neural_node_icon.png';
import organismEggUrl from './assets/images/organism_egg.png';
import nutrientParticleUrl from './assets/images/nutrient_particle.png';
import dnaHelixIconUrl from './assets/images/dna_helix_icon.png';
import ambientMusicUrl from './assets/audio/ambient_deep_water_bgm.mp3';
import alternateMusicUrl from './assets/audio/coral_depths.mp3';

import {
  XoshiroPRNG,
  UNIT_SIZE,
  BASAL_METABOLIC_RATE,
  SENSORY_NEURAL_METABOLIC_RATE,
  NEURAL_EDGE_METABOLIC_RATE,
  NUM_HIDDEN,
  enabledBrainEdgeCount,
  brainEdgeKey,
  memoryUpkeep,
  BASE_FOUNDER_AREA,
  NUTRIENT_ENERGY_VALUE,
  CONTINUOUS_EAT_RATE,
  OMNIVORE_EAT_RATE,
  ArchetypeId,
  Genome,
  Organism,
  Egg,
  Nutrient,
  LineageRecord,
  SpecimenBankItem,
  SimulationSettings,
  SimulationState,
  clampVal,
  hsl,
  getBodyPigment,
  getFoodRGB,
  addNutrients,
  nutrientSpawnSlots,
  getLifeStage,
  evaluateReproductionAffordability,
  evaluateEggHatchStatus,
  getEggReserveFunding,
  getDietClassification,
  getNutrientRadius,
  getCardinalAnchor,
  getOrganAnchor,
  getChildAnchorForParentDir,
  getCardinalOutwardNormal,
  calculateTotalBodyArea,
  formatJoules,
  createArchetypeGenome,
  stepSimulation
} from './simulation';
import {FOUNDER_BLUEPRINTS, FEATURED_BLUEPRINTS, FOUNDER_FAMILIES, createFounderBankItems, type FounderMode} from './founders';
import {BUILD_VERSION, CREDITS, createSnapshot, restoreSnapshot, validateGenome,
  clearFreeNutrients, resizeWorld, diagnosticReport} from './persistence';
export * from './simulation';

// Bound floating windows to the visible tank area, including after resizing.
function useDraggableModal(initialX: number, initialY: number) {
  const [pos, setPos] = useState({x: initialX, y: initialY});
  const elementRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const dragStartRef = useRef<{x: number; y: number; posX: number; posY: number} | null>(null);
  const clampPosition = useCallback((candidate: {x: number; y: number}) => {
    const node = elementRef.current, area = node?.parentElement;
    if (!node || !area) return candidate;
    return {x: clampVal(candidate.x, 8, Math.max(8, area.clientWidth - node.offsetWidth - 8)),
      y: clampVal(candidate.y, 8, Math.max(8, area.clientHeight - node.offsetHeight - 8))};
  }, []);
  const panelRef = useCallback((node: HTMLDivElement | null) => {
    observerRef.current?.disconnect(); elementRef.current = node;
    if (!node) return;
    const fit = () => setPos(current => {
      const next = clampPosition(current);
      return current.x === next.x && current.y === next.y ? current : next;
    });
    observerRef.current = new ResizeObserver(fit); observerRef.current.observe(node);
    if (node.parentElement) observerRef.current.observe(node.parentElement);
    fit();
  }, [clampPosition]);
  useEffect(() => () => observerRef.current?.disconnect(), []);
  const finish = (e: React.PointerEvent) => {
    dragStartRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return {pos, panelRef, headerProps: {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('button,input,select,textarea')) return;
      e.stopPropagation(); dragStartRef.current = {x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y};
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const start = dragStartRef.current; if (!start) return;
      e.stopPropagation();
      setPos(clampPosition({x: start.posX + e.clientX - start.x, y: start.posY + e.clientY - start.y}));
    },
    onPointerUp: finish, onPointerCancel: finish,
  }};
}

// ============================================================================
// 4. MAIN REACT COMPONENT (App)
// ============================================================================
function organSlotLabel(organ: {direction: string; slot?: number}): string {
  if (organ.slot === undefined || organ.slot === 0) return 'center';
  const horizontalFace = organ.direction === 'NORTH' || organ.direction === 'SOUTH';
  return organ.slot === 1 ? (horizontalFace ? 'left' : 'upper') : (horizontalFace ? 'right' : 'lower');
}

function readAudioVolume(key: string, fallback: number): number {
  try {
    const saved = localStorage.getItem(key);
    const value = saved === null || saved.trim() === '' ? NaN : Number(saved);
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  } catch { return fallback; }
}

function AudioControls({sfxVolume, musicVolume, sfxMuted, musicMuted,
  onSfxVolume, onMusicVolume, onSfxMute, onMusicMute, musicTrack, onMusicTrack}: {
  sfxVolume: number; musicVolume: number; sfxMuted: boolean; musicMuted: boolean;
  onSfxVolume: (volume: number) => void; onMusicVolume: (volume: number) => void;
  onSfxMute: () => void; onMusicMute: () => void;
  musicTrack: 'track1' | 'track2'; onMusicTrack: (track: 'track1' | 'track2') => void;
}) {
  return <div className="w-full grid grid-cols-2 gap-3 my-1">
    {[
      {name: 'SFX', volume: sfxVolume, muted: sfxMuted, change: onSfxVolume, mute: onSfxMute},
      {name: 'Music', volume: musicVolume, muted: musicMuted, change: onMusicVolume, mute: onMusicMute},
    ].map(({name, volume, muted, change, mute}) => <div key={name} className="min-w-0 flex flex-col gap-2">
      <button type="button" aria-label={`Mute ${name}`} aria-pressed={muted}
        onClick={(e) => { e.stopPropagation(); mute(); }}
        className={`px-3 py-2.5 rounded-xl border font-mono text-xs font-bold flex items-center justify-center gap-2 transition-colors ${muted
          ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          : 'bg-slate-800 border-slate-700 text-cyan-300 hover:bg-slate-700'}`}>
        {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        {name}: {muted ? 'Muted' : 'Active'}
      </button>
      <label className="flex flex-col gap-1 text-[10px] font-mono text-slate-300 text-left">
        <span className="flex justify-between gap-2"><span>{name} volume</span><span>{Math.round(volume * 100)}%</span></span>
        <input type="range" min="0" max="1" step="0.01" value={volume}
          aria-label={`${name} volume`} aria-valuetext={`${Math.round(volume * 100)} percent`}
          onChange={(e) => change(Number(e.target.value))}
          className="w-full accent-cyan-400 cursor-pointer" />
      </label>
    </div>)}
    <label className="col-span-2 flex items-center justify-between gap-3 text-xs font-mono text-slate-300">
      Music track
      <select aria-label="Music track" value={musicTrack}
        onChange={(e) => onMusicTrack(e.target.value === 'track2' ? 'track2' : 'track1')}
        className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-cyan-300">
        <option value="track1">Track 1</option>
        <option value="track2">Track 2</option>
      </select>
    </label>
  </div>;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [{width: canvasWidth, height: canvasHeight}, setViewportSize] = useState({width: 1280, height: 720});
  useEffect(() => {
    const node = viewportRef.current; if (!node) return;
    const measure = () => { const rect = node.getBoundingClientRect(); setViewportSize({width: Math.max(1, rect.width), height: Math.max(1, rect.height)}); };
    const observer = new ResizeObserver(measure); observer.observe(node); measure();
    return () => observer.disconnect();
  }, []);
  const stepperRef = useRef<ReturnType<typeof createFixedStepper>>();

  const ASSETS_MANIFEST: Record<string, string> = {
    neuralNodeIcon: neuralNodeIconUrl,
    organismEgg: organismEggUrl,
    nutrientParticle: nutrientParticleUrl,
    dnaHelixIcon: dnaHelixIconUrl,
  };
  const {assets, isReady: assetsReady} = useAssets(ASSETS_MANIFEST);

  const isMobile = useIsMobile();
  const [worldWidth, setWorldWidth] = useState(clampVal(getConfig('worldWidth'), 800, 4800));
  const [worldHeight, setWorldHeight] = useState(clampVal(getConfig('worldHeight'), 600, 3000));

  if (!stepperRef.current) {
    const stepMs = getConfig('stepMs');
    const maxSubSteps = getConfig('maxSubSteps');
    stepperRef.current = createFixedStepper(stepMs, maxSubSteps);
  }

  // React State for HUD & Modals
  const [gameState, setGameState] = useState<GameState>({
    status: 'START',
    score: 0,
    level: 1,
  });

  const [isGameMenuOpen, setIsGameMenuOpen] = useState(false);
  const [isHowToPlayOpen, setIsHowToPlayOpen] = useState(false);
  const [isBrainInspectorOpen, setIsBrainInspectorOpen] = useState(false);
  const [inspectorActiveTab, setInspectorActiveTab] = useState<'brain' | 'morphology' | 'energy' | 'lineage' | 'verification'>('brain');
  const [isEcosystemGraphOpen, setIsEcosystemGraphOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSpecimenBankOpen, setIsSpecimenBankOpen] = useState(false);
  const [isArenaOpen, setIsArenaOpen] = useState(false);
  const [showTraces, setShowTraces] = useState(false);
  const [showMouthApertures, setShowMouthApertures] = useState(true);
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [sfxVolume, setSfxVolume] = useState(() => readAudioVolume('vida:sfxVolume', 0.6));
  const [musicVolume, setMusicVolume] = useState(() => readAudioVolume('vida:musicVolume', getConfig('defaultMusicVolume')));
  const [musicTrack, setMusicTrack] = useState<'track1' | 'track2'>(() => {
    try { return localStorage.getItem('vida:musicTrack') === 'track2' ? 'track2' : 'track1'; }
    catch { return 'track1'; }
  });
  useEffect(() => {
    try { localStorage.setItem('vida:musicTrack', musicTrack); } catch {}
  }, [musicTrack]);
  useEffect(() => {
    gameAudio.setVolume(sfxVolume);
    try { localStorage.setItem('vida:sfxVolume', String(sfxVolume)); } catch {}
  }, [sfxVolume]);
  useEffect(() => {
    try { localStorage.setItem('vida:musicVolume', String(musicVolume)); } catch {}
  }, [musicVolume]);
  const [timeMultiplier, setTimeMultiplier] = useState<1 | 2 | 5 | 10 | 20 | 50>(1);

  // Settings & Configuration Sliders
  const [waterViscosity, setWaterViscosity] = useState<number>((getConfig('waterViscosity') as number) ?? 0.22);
  const [targetNutrientAbundance, setTargetNutrientAbundance] = useState<number>(clampVal(getConfig('targetNutrientCount') ?? 400, 0, 800));
  const [nutrientInflowRate, setNutrientInflowRate] = useState<number>((getConfig('nutrientInflowRate') as number) ?? 15);
  const [kinshipProtectionEnabled, setKinshipProtectionEnabled] = useState<boolean>(true);
  const [gravity, setGravity] = useState(0);
  const [mutationSeverity, setMutationSeverity] = useState(getConfig('mutationRate'));
  const [maxOrganisms, setMaxOrganisms] = useState(100);
  const [simulationSeed, setSimulationSeed] = useState(4242);
  const [founderMode, setFounderMode] = useState<FounderMode>('balanced');
  const [bankFamily, setBankFamily] = useState('All');
  const [bankDiet, setBankDiet] = useState('All');
  const [bankSearch, setBankSearch] = useState('');
  const [bankSection, setBankSection] = useState<'featured' | 'legacy' | 'saved' | 'all'>('featured');
  const [reportText, setReportText] = useState('');
  const founderBankItems = useMemo(() => createFounderBankItems(founderMode), [founderMode]);
  const [synapsePruningThreshold, setSynapsePruningThreshold] = useState<number>(0.02);
  const [customBranchName, setCustomBranchName] = useState<string>('Parallel Ocean');

  // Draggable Modals
  const inspectorDraggable = useDraggableModal(typeof window !== 'undefined' ? window.innerWidth - 540 : 700, 52);
  const settingsDraggable = useDraggableModal(16, 56);
  const ledgerDraggable = useDraggableModal(16, typeof window !== 'undefined' ? window.innerHeight - 400 : 380);
  const badgeDraggable = useDraggableModal(16, 12);
  const eggDraggable = useDraggableModal(16, 68);
  const bankDraggable = useDraggableModal(typeof window !== 'undefined' ? window.innerWidth / 2 - 200 : 400, 60);
  const arenaDraggable = useDraggableModal(typeof window !== 'undefined' ? window.innerWidth / 2 - 260 : 350, 40);

  const ignoreCanvasClickUntilRef = useRef<number>(0);
  const pointerDownStateRef = useRef<{x: number; y: number; time: number; active: boolean}>({
    x: 0,
    y: 0,
    time: 0,
    active: false,
  });

  // Diagnostic Test Suite State
  const [diagnosticResults, setDiagnosticResults] = useState<{
    ran: boolean;
    comLocomotion: boolean;
    zeroDragConservation: boolean;
    eggEnergyAccounting: boolean;
    reproductionAffordability: boolean;
    raycastOcclusion: boolean;
    prngDeterminism: boolean;
    starvationLifespan: boolean;
    details: string[];
  }>({
    ran: false,
    comLocomotion: false,
    zeroDragConservation: false,
    eggEnergyAccounting: false,
    reproductionAffordability: false,
    raycastOcclusion: false,
    prngDeterminism: false,
    starvationLifespan: false,
    details: [],
  });

  // Specimen Bank & Comparison Arena State
  const [specimenBank, setSpecimenBank] = useState<SpecimenBankItem[]>([]);
  const displayedSpecimenBank = useMemo(() => [...founderBankItems, ...specimenBank].filter(item =>
    (bankSection === 'all' || (bankSection === 'saved' ? !item.id.startsWith('FOUNDER-')
      : item.tags.includes(bankSection === 'featured' ? 'Featured' : 'Legacy')))
    && (bankFamily === 'All' || item.genome.archetype === bankFamily)
    && (bankDiet === 'All' || getDietClassification(item.genome.mouths).category.toLowerCase() === bankDiet)
    && item.name.toLowerCase().includes(bankSearch.toLowerCase())),
    [founderBankItems, specimenBank, bankSection, bankFamily, bankDiet, bankSearch]);
  const [saveNotification, setSaveNotification] = useState<string | null>(null);
  const [arenaCompetitorA, setArenaCompetitorA] = useState<Genome | null>(null);
  const [arenaCompetitorB, setArenaCompetitorB] = useState<Genome | null>(null);
  const [arenaState, setArenaState] = useState<{
    running: boolean;
    time: number;
    distA: number;
    distB: number;
    speedA: number;
    speedB: number;
  }>({running: false, time: 0, distA: 0, distB: 0, speedA: 0, speedB: 0});

  // Ecosystem Statistics
  const [ecoStats, setEcoStats] = useState({
    simTime: 0,
    livingCount: 0,
    eggCount: 0,
    maxGeneration: 1,
    avgGeneration: 1,
    totalBirths: 0,
    totalDeaths: 0,
    fastestSpeed: 0,
    nutrientCount: 0,
    targetNutrients: targetNutrientAbundance,
    totalStoredBiomass: 0,
    totalStoredReserves: 0,
    totalEggEnergy: 0,
    totalFoodEnergy: 0,
    totalExternalInflow: 0,
    totalMetabolicHeat: 0,
    totalMechanicalHeat: 0,
    totalRecordedLosses: 0,
    herbivoreCount: 0,
    carnivoreCount: 0,
    omnivoreCount: 0,
    carrionCount: 0,
    simTimeRatio: 1.0,
    renderFPS: 60,
    physicsStepsPerSec: 60,
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedEggId, setSelectedEggId] = useState<string | null>(null);
  const [selectedSpecimen, setSelectedSpecimen] = useState<Organism | null>(null);
  const [isAutoTracking, setIsAutoTracking] = useState(false);

  // History for telemetry graph
  const popHistoryRef = useRef<number[]>([]);

  // AUTHORITATIVE SIMULATION STATE IN REF
  const simStateRef = useRef<SimulationState>({
    simTime: 0,
    organisms: [],
    eggs: [],
    nutrients: [],
    bubbles: [],
    caustics: [],
    ledger: {
      externalInflow: 0,
      metabolicDissipation: 0,
      mechanicalWorkHeat: 0,
      recordedLosses: 0,
    },
    nutrientAccumulator: 0,
    totalBirths: 0,
    totalDeaths: 0,
    prng: new XoshiroPRNG(4242),
    lineage: new Map<string, LineageRecord>(),
    recentDeaths: [],
  });
  // A selected egg remains a reference to actual kernel state; no duplicated
  // incubation/clearance counters or saved UI-only status fields.
  const selectedEgg = selectedEggId ? simStateRef.current.eggs.find(egg => egg.id === selectedEggId) : null;

  // Telemetry Performance Tracker
  const realTimeTrackerRef = useRef({
    lastRealTime: performance.now(),
    simulatedSecsThisInterval: 0,
    realSecsThisInterval: 0,
    achievedRatio: 1.0,
    framesThisSec: 0,
    physicsStepsThisSec: 0,
    lastFPSUpdate: performance.now(),
    renderFPS: 60,
    physicsStepsPerSec: 60,
  });

  // Camera State
  const cameraRef = useRef({
    x: worldWidth / 2,
    y: worldHeight / 2,
    zoom: 0.85,
    targetX: worldWidth / 2,
    targetY: worldHeight / 2,
    isDragging: false,
    lastDragX: 0,
    lastDragY: 0,
  });

  // A replacement world must never be stepped by a render holding its old settings.
  const [worldEpoch, setWorldEpoch] = useState(0);
  const worldEpochRef = useRef(0);
  const replaceWorld = useCallback((state: SimulationState) => {
    worldEpochRef.current++;
    simStateRef.current = state;
    setWorldEpoch(worldEpochRef.current);
  }, []);

  const statsTimerRef = useRef(0);
  const timeMultiplierRef = useRef(timeMultiplier);
  timeMultiplierRef.current = timeMultiplier;

  useEffect(() => {
    (window as any).canHandleBackKey = gameState.status !== 'START';
  }, [gameState.status]);


  const closeInspector = useCallback((e?: React.MouseEvent | React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    ignoreCanvasClickUntilRef.current = Date.now() + 400;
    setIsBrainInspectorOpen(false);
    setSelectedOrgId(null);
    setSelectedSpecimen(null);
    setSelectedEggId(null);
    setIsAutoTracking(false);
    gameAudio.playCrispClick();
  }, []);

  // Save / Load Specimen Bank to LocalStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vida_specimen_bank_v3');
      if (saved) {
        const items = JSON.parse(saved);
        if (Array.isArray(items)) setSpecimenBank(items.slice(0, 25).flatMap(item => {
          try { return [{...item, genome: validateGenome(item.genome)}]; } catch { return []; }
        }));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveCurrentSpecimenToBank = useCallback((name?: string) => {
    if (!selectedSpecimen) return;
    const item: SpecimenBankItem = {
      id: `BANK-${Date.now().toString(36).toUpperCase()}`,
      name: name || selectedSpecimen.genome.name || `Specimen ${selectedSpecimen.genome.id}`,
      savedAt: new Date().toLocaleTimeString(),
      genome: JSON.parse(JSON.stringify(selectedSpecimen.genome)),
      tags: [selectedSpecimen.genome.archetype || 'Custom', `Gen ${selectedSpecimen.genome.generation}`],
    };
    const updated = [item, ...specimenBank.slice(0, 24)];
    setSpecimenBank(updated);
    try {
      localStorage.setItem('vida_specimen_bank_v3', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setSaveNotification(`Saved "${item.name}" to Specimen Bank!`);
    setTimeout(() => setSaveNotification(null), 2500);
    gameAudio.playPowerupChime();
  }, [selectedSpecimen, specimenBank]);

  const currentSettings = useCallback((): SimulationSettings => ({worldWidth, worldHeight, waterViscosity,
    targetNutrients: targetNutrientAbundance, inflowRate: nutrientInflowRate, kinshipProtection: kinshipProtectionEnabled,
    mutationSeverity, gravity, maxOrganisms}),
    [worldWidth, worldHeight, waterViscosity, targetNutrientAbundance, nutrientInflowRate, kinshipProtectionEnabled, gravity, maxOrganisms, mutationSeverity]);

  const changeTankSize = (width: number, height: number) => {
    resizeWorld(simStateRef.current, currentSettings(), width, height);
    const dx = (width - worldWidth) / 2, dy = (height - worldHeight) / 2;
    const cam = cameraRef.current;
    cam.x = clampVal(cam.x + dx, 0, width); cam.targetX = clampVal(cam.targetX + dx, 0, width);
    cam.y = clampVal(cam.y + dy, 0, height); cam.targetY = clampVal(cam.targetY + dy, 0, height);
    setWorldWidth(width); setWorldHeight(height);
    replaceWorld(simStateRef.current);
  };

  const copyDiagnosticReport = async () => {
    const report = JSON.stringify(diagnosticReport(simStateRef.current, currentSettings(), selectedOrgId,
      {seed: simStateRef.current.initialSeed ?? simulationSeed, founderMode}), null, 2);
    setReportText(report);
    try { await navigator.clipboard.writeText(report); setSaveNotification('Diagnostic report copied.'); }
    catch { setSaveNotification('Select and copy the diagnostic report below.'); }
    setTimeout(() => setSaveNotification(null), 2500);
  };

  // Fork a complete, independent state without changing simulation randomness.
  const branchEcosystem = useCallback(() => {
    replaceWorld(restoreSnapshot(createSnapshot(simStateRef.current, currentSettings())).state);
    setSelectedOrgId(null); setSelectedSpecimen(null); setSelectedEggId(null); setIsAutoTracking(false);
    setSaveNotification(`Branched ecosystem: ${customBranchName}`);
    setTimeout(() => setSaveNotification(null), 2500);
    gameAudio.playLevelUpStinger();
  }, [customBranchName, currentSettings, replaceWorld]);

  const exportEcosystemJSON = useCallback(() => {
    const s = simStateRef.current;
    const payload = createSnapshot(s, currentSettings(), {seed: s.initialSeed ?? simulationSeed, founderMode, branch: customBranchName,
      populationHistory: popHistoryRef.current});
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], {type: 'application/json'}));
    const a = document.createElement('a'); a.href = url;
    a.download = `vida_snapshot_t${Math.round(s.simTime)}s.json`; a.click();
    URL.revokeObjectURL(url); gameAudio.playConfirmSelect();
  }, [currentSettings, simulationSeed, founderMode, customBranchName]);

  const importEcosystemJSON = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    if (file.size > 25_000_000) { setSaveNotification('Snapshot exceeds 25 MB.'); return; }
    void file.text().then(text => {
      const restored = restoreSnapshot(text);
      const v = restored.settings;
      replaceWorld(restored.state);
      setEcoStats(prev => ({...prev, ...collectWorldStats(restored.state, v.targetNutrients)}));
      setWorldWidth(v.worldWidth); setWorldHeight(v.worldHeight); setGravity(v.gravity ?? 0);
      setWaterViscosity(v.waterViscosity); setTargetNutrientAbundance(v.targetNutrients); setNutrientInflowRate(v.inflowRate);
      setKinshipProtectionEnabled(v.kinshipProtection); setMaxOrganisms(v.maxOrganisms ?? 100); setMutationSeverity(v.mutationSeverity);
      if (Number.isInteger(restored.metadata.seed)) setSimulationSeed(Number(restored.metadata.seed));
      if (restored.metadata.founderMode === 'balanced' || restored.metadata.founderMode === 'unbiased') setFounderMode(restored.metadata.founderMode);
      popHistoryRef.current = Array.isArray(restored.metadata.populationHistory) ? restored.metadata.populationHistory as number[] : [];
      setSelectedOrgId(null); setSelectedSpecimen(null); setSelectedEggId(null); setIsAutoTracking(false);
      cameraRef.current.x = cameraRef.current.targetX = v.worldWidth / 2;
      cameraRef.current.y = cameraRef.current.targetY = v.worldHeight / 2;
      setGameState(prev => ({...prev, status: 'PAUSED'}));
      setSaveNotification('Snapshot restored. Resume when ready.');
      setTimeout(() => setSaveNotification(current => current === 'Snapshot restored. Resume when ready.' ? null : current), 2500);
      gameAudio.playLevelUpStinger();
    }).catch(error => setSaveNotification(error instanceof Error ? error.message : 'Invalid snapshot.'));
  }, [replaceWorld]);

  const [diagnosticsRunning, setDiagnosticsRunning] = useState(false);
  const runDiagnosticSuite = useCallback(async () => {
    setDiagnosticsRunning(true);
    try { setDiagnosticResults(await runProductionChecks()); }
    catch (error) { setSaveNotification(`Diagnostics failed: ${error instanceof Error ? error.message : error}`); }
    finally { setDiagnosticsRunning(false); }
  }, []);

  // Initialize Simulation
  const initGame = useCallback(
    (preset = 'standard') => {
      replaceWorld(createInitialWorld(currentSettings(), simulationSeed, founderMode, preset, getConfig('initialOrganisms')));
      popHistoryRef.current = [simStateRef.current.organisms.length];
      setEcoStats(prev => ({...prev, ...collectWorldStats(simStateRef.current, targetNutrientAbundance)}));

      setSelectedOrgId(null);
      setSelectedSpecimen(null);
      setSelectedEggId(null);
      setIsBrainInspectorOpen(false);
      setIsAutoTracking(false);
      cameraRef.current.x = worldWidth / 2;
      cameraRef.current.y = worldHeight / 2;
      cameraRef.current.targetX = worldWidth / 2;
      cameraRef.current.targetY = worldHeight / 2;
      cameraRef.current.zoom = 0.85;

      setGameState({
        status: 'PLAYING',
        score: simStateRef.current.organisms.length,
        level: 1,
      });

      gameAudio.playConfirmSelect();
    },
    [worldWidth, worldHeight, currentSettings, simulationSeed, founderMode, replaceWorld],
  );


  // Manual Add Life
  const addPrimordialSpecimen = useCallback((archetype: ArchetypeId = 'random', customGenome?: Genome) => {
    const s = simStateRef.current;
    if (s.organisms.filter(o => !o.dissolving).length >= maxOrganisms) { setSaveNotification('Population cap reached.'); return; }
    const cam = cameraRef.current;
    const ox = clampVal(cam.x + s.prng.range(-80, 80), 100, worldWidth - 100);
    const oy = clampVal(cam.y + s.prng.range(-80, 80), 100, worldHeight - 100);
    const genome = customGenome ? structuredClone(customGenome) : createArchetypeGenome(archetype, 1, [], s.prng);
    const specimen = addExternalOrganism(s, genome, currentSettings(), ox, oy);
    if (!specimen) return;

    setSelectedOrgId(specimen.id);
    setSelectedSpecimen(specimen);
    setSelectedEggId(null);
    gameAudio.playPowerupChime();

    setGameState((prev) => {
      if (prev.status === 'GAME_OVER') {
        return {...prev, status: 'PLAYING'};
      }
      return prev;
    });
  }, [worldWidth, worldHeight, maxOrganisms, currentSettings]);

  const hasAutoplayed = useRef(false);
  useEffect(() => {
    if (
      !hasAutoplayed.current &&
      new URLSearchParams(window.location.search).has('autoplay')
    ) {
      hasAutoplayed.current = true;
      initGame('standard');
    }
  }, [initGame]);

  // Spawn manual nutrient burst
  const spawnNutrientBurst = useCallback(
    (worldX?: number, worldY?: number, count = 15) => {
      const s = simStateRef.current;
      if (nutrientSpawnSlots(s, currentSettings()) === 0) return;
      const cx = worldX ?? cameraRef.current.x, cy = worldY ?? cameraRef.current.y;
      if (addNutrients(s, currentSettings(), count, {x: cx, y: cy, spread: 80})) gameAudio.playPotionGulp();
    }, [currentSettings],
  );

  // Feed All adds capped plant food near living creatures, not directly to reserves.
  const feedAllOrganisms = useCallback(() => {
    const s = simStateRef.current, living = s.organisms.filter(o => !o.dissolving);
    if (!living.length) { spawnNutrientBurst(worldWidth / 2, worldHeight / 2, 35); return; }
    let added = 0;
    for (const org of living) {
      added += addNutrients(s, currentSettings(), 2, {...org.segments[0], spread: 60});
      if (!nutrientSpawnSlots(s, currentSettings())) break;
    }
    if (added) gameAudio.playPotionGulp();
  }, [worldWidth, worldHeight, currentSettings, spawnNutrientBurst]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['input', 'textarea', 'select'].includes(target?.tagName?.toLowerCase()) || target?.isContentEditable) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();

        if (isBrainInspectorOpen) {
          setIsBrainInspectorOpen(false);
        } else if (selectedEggId) {
          setSelectedEggId(null);
          ignoreCanvasClickUntilRef.current = Date.now() + 400;
        } else if (selectedOrgId) {
          ignoreCanvasClickUntilRef.current = Date.now() + 400;
          setSelectedOrgId(null);
          setSelectedSpecimen(null);
          setIsAutoTracking(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isEcosystemGraphOpen) {
          setIsEcosystemGraphOpen(false);
        } else if (isSpecimenBankOpen) {
          setIsSpecimenBankOpen(false);
        } else if (isArenaOpen) {
          setIsArenaOpen(false);
        } else if (isHowToPlayOpen) {
          setIsHowToPlayOpen(false);
        } else {
          setIsGameMenuOpen((prev) => !prev);
        }
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setGameState((prev) =>
          prev.status === 'PLAYING'
            ? {...prev, status: 'PAUSED'}
            : prev.status === 'PAUSED'
            ? {...prev, status: 'PLAYING'}
            : prev,
        );
      } else if (e.key.toLowerCase() === 'f') {
        spawnNutrientBurst();
      } else if (e.key.toLowerCase() === 'n') {
        addPrimordialSpecimen();
      } else if (e.key === '1') {
        setTimeMultiplier(1);
        gameAudio.playHoverMicroTone();
      } else if (e.key === '2') {
        setTimeMultiplier(2);
        gameAudio.playHoverMicroTone();
      } else if (e.key === '3') {
        setTimeMultiplier(5);
        gameAudio.playHoverMicroTone();
      } else if (e.key === '4') {
        setTimeMultiplier(10);
        gameAudio.playHoverMicroTone();
      } else if (e.key === '5') {
        setTimeMultiplier(20);
        gameAudio.playHoverMicroTone();
      } else if (e.key.toLowerCase() === 'b') {
        setIsBrainInspectorOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 'g') {
        setIsEcosystemGraphOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === 't') {
        setIsAutoTracking((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [spawnNutrientBurst, addPrimordialSpecimen, isBrainInspectorOpen, selectedEggId, selectedOrgId, isSettingsOpen, isEcosystemGraphOpen, isSpecimenBankOpen, isArenaOpen, isHowToPlayOpen]);

  // Zoom handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      cameraRef.current.zoom = clampVal(cameraRef.current.zoom * zoomFactor, 0.35, 2.8);
    };

    let touchStartDist = 0;
    let initialZoom = 1;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pointerDownStateRef.current.active = false; cameraRef.current.isDragging = false;
        touchStartDist = Math.hypot(dx, dy);
        initialZoom = cameraRef.current.zoom;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && touchStartDist > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const factor = dist / touchStartDist;
        cameraRef.current.zoom = clampVal(initialZoom * factor, 0.35, 2.8);
      }
    };

    canvas.addEventListener('wheel', handleWheel, {passive: false});
    canvas.addEventListener('touchstart', handleTouchStart, {passive: true});
    canvas.addEventListener('touchmove', handleTouchMove, {passive: true});

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Update Loop
  const update = (deltaTime: number) => {
    if (worldEpoch !== worldEpochRef.current || gameState.status !== 'PLAYING' || isGameMenuOpen) return;

    const multiplier = timeMultiplierRef.current;
    const fixedDt = 1 / 60;
    const s = simStateRef.current;

    const settings: SimulationSettings = {
      worldWidth,
      worldHeight,
      waterViscosity,
      targetNutrients: targetNutrientAbundance,
      inflowRate: nutrientInflowRate,
      kinshipProtection: kinshipProtectionEnabled,
      mutationSeverity,
      maxOrganisms,
      gravity,
    };

    // Computation budget cap (16ms per frame to prevent freezing)
    const frameStartTime = performance.now();
    let stepsRun = 0;

    for (let step = 0; step < multiplier; step++) {
      stepSimulation(s, settings, fixedDt, (evt) => {
        if (evt === 'clash') gameAudio.playSwordClash();
        else if (evt === 'eat') gameAudio.playCoinPickup();
        else if (evt === 'birth') gameAudio.playPowerupChime();
      });
      realTimeTrackerRef.current.physicsStepsThisSec += 1;
      stepsRun++;
      if (performance.now() - frameStartTime > 16.0 && multiplier > 20) break;
    }

    const tracker = realTimeTrackerRef.current;
    const now = performance.now();
    const realSecs = (now - tracker.lastRealTime) / 1000;
    tracker.lastRealTime = now;
    tracker.realSecsThisInterval += realSecs;
    tracker.simulatedSecsThisInterval += fixedDt * stepsRun;

    if (tracker.realSecsThisInterval >= 0.5) {
      tracker.achievedRatio = tracker.simulatedSecsThisInterval / Math.max(0.001, tracker.realSecsThisInterval);
      tracker.realSecsThisInterval = 0;
      tracker.simulatedSecsThisInterval = 0;
    }

    if (now - tracker.lastFPSUpdate >= 1000) {
      tracker.renderFPS = tracker.framesThisSec;
      tracker.physicsStepsPerSec = tracker.physicsStepsThisSec;
      tracker.framesThisSec = 0;
      tracker.physicsStepsThisSec = 0;
      tracker.lastFPSUpdate = now;
    }

    // Camera follow
    const cam = cameraRef.current;
    if (isAutoTracking && selectedOrgId) {
      const tracked = s.organisms.find((o) => o.id === selectedOrgId);
      if (tracked && !tracked.dissolving) {
        cam.targetX = tracked.segments[0].x;
        cam.targetY = tracked.segments[0].y;
      } else {
        setSelectedOrgId(null);
        setSelectedSpecimen(null);
        setIsAutoTracking(false);
      }
    }
    cam.x += (cam.targetX - cam.x) * Math.min(1, deltaTime * 5);
    cam.y += (cam.targetY - cam.y) * Math.min(1, deltaTime * 5);

    statsTimerRef.current += fixedDt * stepsRun;
    if (statsTimerRef.current >= 0.25) {
      statsTimerRef.current = 0;

      const stats = collectWorldStats(s, targetNutrientAbundance);
      const maxGen = stats.maxGeneration;
      setEcoStats({...stats, simTimeRatio: Math.round(tracker.achievedRatio * 10) / 10,
        renderFPS: tracker.renderFPS, physicsStepsPerSec: tracker.physicsStepsPerSec});

      const selected = selectedOrgId ? s.organisms.find((o) => o.id === selectedOrgId) : null;
      setSelectedSpecimen(selected || null);
      if (selectedEggId && !s.eggs.some(egg => egg.id === selectedEggId)) setSelectedEggId(null);

      popHistoryRef.current.push(s.organisms.filter(o => !o.dissolving).length);
      if (popHistoryRef.current.length > 60) popHistoryRef.current.shift();

      if (s.organisms.length === 0 && s.eggs.length === 0) {
        if (gameState.status === 'PLAYING') {
          setGameState((prev) => ({...prev, status: 'GAME_OVER'}));
          gameAudio.playDefeatMotif();
        }
      } else {
        setGameState((prev) => ({
          ...prev,
          score: Math.max(prev.score, maxGen * 100 + s.totalBirths * 10),
          level: maxGen,
        }));
      }
    }
  };

  const canvasPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {x: (e.clientX - rect.left) * canvasWidth / rect.width,
      y: (e.clientY - rect.top) * canvasHeight / rect.height};
  };
  const handleCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!e.isPrimary || e.button !== 0) return;
    const p = canvasPoint(e), cam = cameraRef.current;
    pointerDownStateRef.current = {...p, time: Date.now(), active: true};
    cam.isDragging = true; cam.lastDragX = p.x; cam.lastDragY = p.y;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const start = pointerDownStateRef.current; if (!start.active || !e.isPrimary) return;
    const p = canvasPoint(e), cam = cameraRef.current;
    if (Math.hypot(p.x - start.x, p.y - start.y) > 5) {
      cam.targetX -= (p.x - cam.lastDragX) / cam.zoom;
      cam.targetY -= (p.y - cam.lastDragY) / cam.zoom; setIsAutoTracking(false);
    }
    cam.lastDragX = p.x; cam.lastDragY = p.y;
  };
  const handleCanvasUp = (e: React.PointerEvent<HTMLCanvasElement>, cancelled = false) => {
    const start = pointerDownStateRef.current; if (!start.active || !e.isPrimary) return;
    const p = canvasPoint(e), cam = cameraRef.current; start.active = false; cam.isDragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (cancelled || Math.hypot(p.x - start.x, p.y - start.y) >= 6 || Date.now() - start.time >= 500
      || Date.now() <= ignoreCanvasClickUntilRef.current) return;
    const x = cam.x + (p.x - canvasWidth / 2) / cam.zoom, y = cam.y + (p.y - canvasHeight / 2) / cam.zoom;
    const egg = simStateRef.current.eggs.find(egg => Math.hypot(egg.x - x, egg.y - y) < 24 / cam.zoom);
    if (egg) {
      setSelectedEggId(egg.id); setSelectedOrgId(null); setSelectedSpecimen(null);
      setIsBrainInspectorOpen(false); setIsAutoTracking(false);
      gameAudio.playConfirmSelect();
      return;
    }
    const clicked = simStateRef.current.organisms.find(org => org.segments.some(seg => Math.hypot(seg.x - x, seg.y - y) < 45 / cam.zoom));
    setSelectedEggId(null); setSelectedOrgId(clicked?.id ?? null); setSelectedSpecimen(clicked ?? null);
    setIsBrainInspectorOpen(!!clicked); setIsAutoTracking(!!clicked);
    if (clicked) gameAudio.playConfirmSelect();
  };

  // Rendering Pipeline
  const draw = (ctx: CanvasRenderingContext2D) => {
    realTimeTrackerRef.current.framesThisSec += 1;
    prepareCanvas(ctx, canvasWidth, canvasHeight);

    const s = simStateRef.current;
    const cam = cameraRef.current;
    const zoom = cam.zoom;

    // Deep water background
    ctx.save();
    const bgGrad = ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, 80,
      canvasWidth / 2, canvasHeight / 2, canvasWidth,
    );
    bgGrad.addColorStop(0, '#0a1e3f');
    bgGrad.addColorStop(0.5, '#051126');
    bgGrad.addColorStop(1, '#020610');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Camera Transform
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);

    // Tank Boundaries & Grid
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
    ctx.lineWidth = 4 / zoom;
    ctx.strokeRect(0, 0, worldWidth, worldHeight);

    ctx.strokeStyle = 'rgba(6, 182, 212, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= worldWidth; gx += 200) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, worldHeight);
      ctx.stroke();
    }
    for (let gy = 0; gy <= worldHeight; gy += 200) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(worldWidth, gy);
      ctx.stroke();
    }

    // Caustics
    for (const c of s.caustics) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(c.x, c.y, Math.max(0, c.radius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(56, 189, 248, ${c.alpha})`;
      ctx.filter = 'blur(16px)';
      ctx.fill();
      ctx.restore();
    }

    // Movement Traces
    if (showTraces) {
      for (const org of s.organisms) {
        if (!org.traceHistory || org.traceHistory.length < 2) continue;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(org.traceHistory[0].x, org.traceHistory[0].y);
        for (let i = 1; i < org.traceHistory.length; i++) {
          ctx.lineTo(org.traceHistory[i].x, org.traceHistory[i].y);
        }
        ctx.strokeStyle = `hsla(${org.genome.hue}, 90%, 65%, 0.35)`;
        ctx.lineWidth = 2 / zoom;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Nutrients
    const nutImg = assets['nutrientParticle'];
    const nutAspect = (getConfig('assetNutrientParticleAspectRatio') as number) || 1.0;
    for (const nut of s.nutrients) {
      const carrion = nut.kind === 'carrion';
      const isSuper = nut.isSuper || nut.energyValue > NUTRIENT_ENERGY_VALUE * 1.25;
      const baseRadius = Math.max(6.0, nut.radius);
      const pulse = 1.0 + Math.sin(nut.pulseTimer || 0) * 0.12;

      ctx.save();
      ctx.translate(nut.x, nut.y);
      const auraRad = Math.max(14, baseRadius * 2.6) * pulse;
      const auraGrad = ctx.createRadialGradient(0, 0, baseRadius * 0.3, 0, 0, auraRad);
      if (carrion) {
        auraGrad.addColorStop(0, 'rgba(240, 120, 106, .75)');
        auraGrad.addColorStop(.45, 'rgba(190, 75, 60, .35)');
        auraGrad.addColorStop(1, 'rgba(190, 75, 60, 0)');
      } else if (isSuper) {
        auraGrad.addColorStop(0, 'rgba(52, 211, 153, 0.9)');
        auraGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.5)');
        auraGrad.addColorStop(1, 'rgba(6, 182, 212, 0)');
      } else {
        auraGrad.addColorStop(0, 'rgba(34, 224, 120, 0.75)');
        auraGrad.addColorStop(0.45, 'rgba(16, 185, 129, 0.35)');
        auraGrad.addColorStop(1, 'rgba(5, 150, 105, 0)');
      }
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(0, 0, auraRad, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      const rgb = getFoodRGB(nut).map(c => Math.round(c * 255));
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.fill();
      ctx.strokeStyle = carrion ? '#ffc5b5' : isSuper ? '#a7f3d0' : '#6ee7b7';
      ctx.lineWidth = Math.max(1.2, 2.0 / zoom);
      ctx.stroke();

      if (!carrion && nutImg && nutImg.complete && nutImg.naturalWidth > 0) {
        const drawSize = baseRadius * 2.2;
        ctx.drawImage(nutImg, -drawSize / 2, -drawSize / 2, drawSize, drawSize / nutAspect);
      }

      ctx.restore();
    }

    // Eggs
    const eggImg = assets['organismEgg'];
    const eggAspect = (getConfig('assetOrganismEggAspectRatio') as number) || 0.785;
    for (const egg of s.eggs) {
      const eggHeight = 32;
      const eggWidth = eggHeight * eggAspect;
      const pulse = 1 + Math.sin(egg.pulseTimer) * 0.08;

      ctx.save();
      ctx.translate(egg.x, egg.y);
      const eggGlow = ctx.createRadialGradient(0, 0, 6, 0, 0, 24 * pulse);
      eggGlow.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
      eggGlow.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = eggGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 0, eggHeight * 0.7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * egg.incubationProgress);
      ctx.strokeStyle = egg.readyToHatch ? '#a7f3d0' : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 1.5; ctx.stroke();
      if (eggImg?.complete && eggImg.naturalWidth > 0) {
        ctx.save(); ctx.filter = 'grayscale(1) brightness(1.8)'; ctx.globalAlpha = .14;
        ctx.drawImage(eggImg, -eggWidth / 2, -eggHeight / 2, eggWidth, eggHeight); ctx.restore();
      }
      if (egg.id === selectedEggId) {
        ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2);
        ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }

    // Bubbles
    for (const b of s.bubbles) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, Math.max(0, b.size), 0, Math.PI * 2);
      ctx.fillStyle = hsl(b.hue, 80, 75, b.alpha);
      ctx.fill();
    }

    // Organisms
    for (const org of s.organisms) {
      const g = org.genome;
      const isSelected = org.id === selectedOrgId;
      const alpha = org.dissolving ? org.dissolveAlpha : 1.0;

      // Selection Aura & Multi-Ray Radar
      if (isSelected) {
        ctx.save();
        const root = org.segments[0];
        ctx.beginPath();
        ctx.arc(root.x, root.y, g.parts[0].width * 1.5 + Math.sin(org.glowPulse) * 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.lineWidth = 2.5 / zoom;
        ctx.setLineDash([6 / zoom, 6 / zoom]);
        ctx.stroke();

        for (const ray of org.rayHits) {
          const eye = g.eyes.find(e => e.id === ray.eyeId);
          const host = eye ? org.segments[eye.partIndex] : org.segments[0];
          const anchor = eye ? getOrganAnchor(eye, g.parts[eye.partIndex].width, g.parts[eye.partIndex].height) : {x: 0, y: 0};
          ctx.beginPath();
          ctx.moveTo(host.x + Math.cos(host.angle) * anchor.x - Math.sin(host.angle) * anchor.y,
            host.y + Math.sin(host.angle) * anchor.x + Math.cos(host.angle) * anchor.y);
          ctx.lineTo(ray.pointX, ray.pointY);
          ctx.strokeStyle = `rgba(${Math.round(ray.r * 255)}, ${Math.round(ray.g * 255)}, ${Math.round(ray.b * 255)}, 0.45)`;
          ctx.lineWidth = 1.2 / zoom;
          ctx.stroke();

          if (ray.hit) {
            ctx.beginPath();
            ctx.arc(ray.pointX, ray.pointY, 3 / zoom, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${Math.round(ray.r * 255)}, ${Math.round(ray.g * 255)}, ${Math.round(ray.b * 255)})`;
            ctx.fill();
          }
        }
        ctx.restore();
      }

      // Render Segments with Discrete NxM grid lines
      for (let sIdx = org.segments.length - 1; sIdx >= 0; sIdx--) {
        const seg = org.segments[sIdx];
        const pDef = g.parts[sIdx];

        ctx.save();
        ctx.translate(seg.x, seg.y);
        ctx.rotate(seg.angle);
        ctx.globalAlpha = alpha;

        const w = pDef.width;
        const h = pDef.height;

        const [partHue, partSaturation, partLight] = getBodyPigment(org, sIdx);

        ctx.fillStyle = hsl(partHue, partSaturation, partLight, 0.88);
        ctx.strokeStyle = hsl(partHue, 95, 80, 0.95);
        ctx.lineWidth = 2;

        const cornerRad = Math.min(w * 0.35, h * 0.35, 6);
        ctx.beginPath();
        ctx.roundRect(-w * 0.5, -h * 0.5, w, h, [cornerRad, cornerRad, cornerRad, cornerRad]);
        ctx.fill();
        ctx.stroke();

        // Discrete NxM Grid Internal Cell Lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = 1;
        for (let n = 1; n < pDef.dimN; n++) {
          const gx = -w * 0.5 + n * UNIT_SIZE;
          ctx.beginPath();
          ctx.moveTo(gx, -h * 0.45);
          ctx.lineTo(gx, h * 0.45);
          ctx.stroke();
        }
        for (let m = 1; m < pDef.dimM; m++) {
          const gy = -h * 0.5 + m * UNIT_SIZE;
          ctx.beginPath();
          ctx.moveTo(-w * 0.45, gy);
          ctx.lineTo(w * 0.45, gy);
          ctx.stroke();
        }

        // Joint Node
        if (sIdx > 0) {
          const childAnchor = getChildAnchorForParentDir(pDef.attachmentPoint, w, h);
          ctx.beginPath();
          ctx.arc(childAnchor.x, childAnchor.y, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.5;
          ctx.fill();
          ctx.stroke();
        }

        // Sensory Eyes
        const partEyes = g.eyes.filter((e) => e.partIndex === sIdx);
        for (const eye of partEyes) {
          const eyeLoc = getOrganAnchor(eye, w, h);
          const eyeScale = eye.slot === undefined ? 1 : Math.min(1, (eye.direction === 'NORTH' || eye.direction === 'SOUTH' ? w : h) / 30);
          ctx.beginPath();
          ctx.arc(eyeLoc.x, eyeLoc.y, 4.5 * eyeScale, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          const lookDir = getCardinalAnchor(eye.direction, 2.5, 2.5);
          ctx.beginPath();
          ctx.arc(eyeLoc.x + lookDir.x * 0.5 * eyeScale, eyeLoc.y + lookDir.y * 0.5 * eyeScale, 2.0 * eyeScale, 0, Math.PI * 2);
          ctx.fillStyle = '#06b6d4';
          ctx.fill();
        }

        // Sensory Mouths with Exact Physical Aperture Outlines
        const partMouths = g.mouths.filter((m) => m.partIndex === sIdx);
        for (const mouth of partMouths) {
          const mouthLoc = getOrganAnchor(mouth, w, h);
          const isCarn = mouth.mouthType === 'carnivore';
          const isOmni = mouth.mouthType === 'omnivore';

          const mouthRadius = isCarn ? 4.5 : isOmni ? 4.0 : 3.5;
          const lastBite = org.recentFeedings?.filter(event => event.mouthId === mouth.id).at(-1);
          const activity = Math.max(org.mouthFeedback?.[mouth.id]?.intake ?? 0,
            lastBite ? clampVal(1 - (s.simTime - lastBite.timestamp) / .3, 0, 1) : 0);
          const opening = activity * (.5 + .5 * Math.sin(s.simTime * 28));
          const halfAperture = Math.max(mouthRadius, mouth.intakeWidth * 0.5);

          // Physical Feeding Aperture Slot Indicator (Visible under HUD toggle or selection)
          if (showMouthApertures || isSelected) {
            ctx.save();
            const normDir = getCardinalOutwardNormal(mouth.direction);
            const tanX = -normDir.y;
            const tanY = normDir.x;
            const a1x = mouthLoc.x - tanX * halfAperture;
            const a1y = mouthLoc.y - tanY * halfAperture;
            const a2x = mouthLoc.x + tanX * halfAperture;
            const a2y = mouthLoc.y + tanY * halfAperture;

            // Aperture span line
            ctx.beginPath();
            ctx.moveTo(a1x, a1y);
            ctx.lineTo(a2x, a2y);
            ctx.strokeStyle = isCarn ? '#f43f5e' : isOmni ? '#c084fc' : '#34d399';
            ctx.lineWidth = Math.max(1.5, 2.5 / zoom);
            ctx.stroke();

            // Geometric contact halo
            ctx.beginPath();
            ctx.arc(mouthLoc.x, mouthLoc.y, mouthRadius, 0, Math.PI * 2);
            ctx.fillStyle = isCarn
              ? 'rgba(244, 63, 94, 0.35)'
              : isOmni
              ? 'rgba(192, 132, 252, 0.35)'
              : 'rgba(52, 211, 153, 0.35)';
            ctx.fill();
            ctx.restore();
          }

          const markerScale = mouth.slot === undefined ? 1 : Math.min(1, (mouth.direction === 'NORTH' || mouth.direction === 'SOUTH' ? w : h) / 42);
          ctx.save(); ctx.translate(mouthLoc.x, mouthLoc.y); ctx.scale(markerScale, markerScale); ctx.translate(-mouthLoc.x, -mouthLoc.y);
          if (isCarn) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(mouthLoc.x, mouthLoc.y, 6.5, 0, Math.PI * 2);
            ctx.fillStyle = '#e11d48';
            ctx.shadowColor = '#f43f5e';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.strokeStyle = '#ffe4e6';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();
          } else if (isOmni) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(mouthLoc.x, mouthLoc.y, 6.0, 0, Math.PI * 2);
            ctx.fillStyle = '#9333ea';
            ctx.shadowColor = '#d946ef';
            ctx.shadowBlur = 10;
            ctx.fill();
            ctx.strokeStyle = '#f0abfc';
            ctx.lineWidth = 1.8;
            ctx.stroke();
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(mouthLoc.x, mouthLoc.y, 5.0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
            ctx.strokeStyle = '#6ee7b7';
            ctx.lineWidth = 1.5;
            ctx.fill();
            ctx.stroke();
          }
          // Bite animation is visual only; physical aperture and optical body stay fixed.
          const normal = getCardinalOutwardNormal(mouth.direction);
          ctx.beginPath();
          ctx.ellipse(mouthLoc.x, mouthLoc.y, 2 + opening * 2.2, .8 + opening * 2.5,
            Math.atan2(normal.y, normal.x), 0, Math.PI * 2);
          ctx.fillStyle = '#020610'; ctx.fill();
          if (activity > 0) {
            ctx.beginPath(); ctx.arc(mouthLoc.x, mouthLoc.y, 7 + opening * 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255,255,255,${activity * .65})`; ctx.lineWidth = 1.2; ctx.stroke();
          }
          ctx.restore();
        }

        ctx.restore();
      }

      // Gravid Aura
      if (org.isGravid) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(org.segments[0].x, org.segments[0].y, g.parts[0].width * 1.2, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${g.hue}, 100%, 75%, ${0.4 + Math.sin(org.glowPulse) * 0.4})`;
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  };

  const updateRef = useRef(update);
  const drawRef = useRef(draw);
  updateRef.current = update;
  drawRef.current = draw;

  useEffect(() => {
    let raf = 0;
    const loop = (time: number) => {
      stepperRef.current?.(time, (dt) => updateRef.current(dt));

      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) drawRef.current(ctx);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasWidth, canvasHeight]);

  const isMusicPlaying = !musicMuted && gameState.status === 'PLAYING';

  return (
    <div className="fixed inset-0 overflow-hidden touch-none flex flex-col items-center justify-between bg-slate-950 text-white select-none">
      {!assetsReady && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-cyan-400">
          <Sparkles className="animate-spin mb-4" size={36} />
          <div className="text-xl font-bold tracking-widest font-mono">
            VIDA: COMPILING RECURRENT CONTROLLERS...
          </div>
        </div>
      )}

      <BackgroundMusic key={musicTrack} url={musicTrack === 'track2' ? alternateMusicUrl : ambientMusicUrl} isPlaying={isMusicPlaying} isMuted={musicMuted} volume={musicVolume} />

      {/* TOP DEDICATED TELEMETRY HUD BAR */}
      <header className="w-full bg-slate-900/95 border-b border-cyan-500/20 backdrop-blur-md px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono font-black text-xs md:text-sm tracking-wider text-cyan-300">
            VIDA
          </span>
          <span className="hidden lg:inline text-[9px] text-slate-400">{CREDITS}</span>
          <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
            GEN {ecoStats.maxGeneration}
          </span>
          <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-950/80 border border-purple-500/30 text-purple-300 font-mono" title="Simulation-to-Real Time Ratio & FPS">
            {ecoStats.simTimeRatio}x ({ecoStats.renderFPS} FPS · {ecoStats.physicsStepsPerSec} Steps/s)
          </span>
          <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
            t = {ecoStats.simTime}s
          </span>
        </div>

        {/* Live Counters with Fixed Stable Widths (Zero Layout Jitter) */}
        <div className="flex items-center gap-1.5 md:gap-2 text-[11px] md:text-xs font-mono flex-wrap">
          <div className="flex items-center gap-1 text-emerald-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
            <Activity size={13} />
            <span>Alive: <strong className="text-white">{ecoStats.livingCount}</strong></span>
          </div>

          <div className="flex items-center gap-1 text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30">
            <span>🌿 Herb: <strong className="text-white">{ecoStats.herbivoreCount}</strong></span>
          </div>

          <div className="flex items-center gap-1 text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-500/30">
            <span>🥩 Carn: <strong className="text-white">{ecoStats.carnivoreCount}</strong></span>
          </div>

          <div className="flex items-center gap-1 text-purple-300 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-500/30">
            <span>🟣 Omni: <strong className="text-white">{ecoStats.omnivoreCount}</strong></span>
          </div>

          <div className="hidden sm:flex items-center gap-1 text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-500/30">
            <span>🥩 Remains: <strong className="text-white">{ecoStats.carrionCount}</strong></span>
          </div>

          <div className="flex items-center gap-1 text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
            <span>🥚 Eggs: <strong className="text-white">{ecoStats.eggCount}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Food: <strong className="text-white">{ecoStats.nutrientCount}</strong><span className="text-emerald-300/60"> / {ecoStats.targetNutrients}</span></span>
          </div>
        </div>

        {/* Speed Controls & Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              addPrimordialSpecimen();
            }}
            title="Seed Primordial Specimen"
            className="px-2.5 py-1 rounded-lg bg-emerald-600/30 border border-emerald-400/50 hover:bg-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1 transition-colors">
            <Plus size={14} />
            <span className="hidden sm:inline">Add Life</span>
          </button>

          {/* Time Multiplier buttons */}
          <div className="flex rounded-lg bg-slate-950 p-0.5 border border-slate-700">
            {([1, 2, 5, 10, 20, 50] as const).map((spd) => (
              <button
                key={spd}
                onClick={(e) => {
                  e.stopPropagation();
                  setTimeMultiplier(spd);
                  gameAudio.playHoverMicroTone();
                }}
                className={`px-1.5 md:px-2 py-1 text-[11px] font-mono rounded font-bold transition-colors ${
                  timeMultiplier === spd
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}>
                {spd === 50 ? 'MAX' : `${spd}x`}
              </button>
            ))}
          </div>

          {/* Specimen Bank Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSpecimenBankOpen((prev) => !prev);
              gameAudio.playCrispClick();
            }}
            title="Specimen Bank (Save & Spawn Custom Genomes)"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isSpecimenBankOpen
                ? 'bg-purple-600/30 border-purple-400 text-purple-300 ring-1 ring-purple-400/50'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            <FolderOpen size={15} />
            <span className="hidden sm:inline font-bold">Bank</span>
          </button>

          {/* Recurrent Brain & Synapse Inspector */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isBrainInspectorOpen) {
                setIsBrainInspectorOpen(false);
                gameAudio.playCrispClick();
              } else {
                if (!selectedOrgId && simStateRef.current.organisms.length > 0) {
                  const first = simStateRef.current.organisms[0];
                  setSelectedOrgId(first.id);
                  setSelectedSpecimen(first);
                }
                setIsBrainInspectorOpen(true);
                gameAudio.playCrispClick();
              }
            }}
            title="Inspect Specimen Brain & Vision Rays"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isBrainInspectorOpen
                ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300 ring-1 ring-cyan-400/50'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            <Network size={15} className="text-cyan-400 animate-pulse" />
            <span className="hidden sm:inline font-bold">Inspector</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsSettingsOpen((prev) => !prev);
              gameAudio.playCrispClick();
            }}
            title="Ecology & Physical Settings"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isSettingsOpen
                ? 'bg-amber-600/30 border-amber-400 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            <Sliders size={15} />
            <span className="hidden sm:inline font-bold">Settings</span>
          </button>

          {/* Ecosystem Graph Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEcosystemGraphOpen((prev) => !prev);
              gameAudio.playCrispClick();
            }}
            title="Ecosystem Telemetry Graph"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
              isEcosystemGraphOpen
                ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}>
            <Activity size={15} />
            <span className="hidden sm:inline">Ledger</span>
          </button>

          {/* Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsGameMenuOpen(true);
              gameAudio.playCrispClick();
            }}
            className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-cyan-400 hover:bg-slate-700 flex items-center gap-1 text-xs">
            <Menu size={16} />
            <span className="hidden md:inline">Menu</span>
          </button>
        </div>
      </header>

      {/* MAIN SIMULATION CANVAS */}
      <div ref={viewportRef} data-testid="tank-viewport" className="flex-1 w-full min-h-0 relative bg-slate-950 overflow-hidden">
        <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight}
          onPointerDown={handleCanvasDown} onPointerMove={handleCanvasMove}
          onPointerUp={e => handleCanvasUp(e)} onPointerCancel={e => handleCanvasUp(e, true)}
          onLostPointerCapture={() => { pointerDownStateRef.current.active = false; cameraRef.current.isDragging = false; }}
          aria-label="Aquatic simulation" className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing block" />

        {/* EGG INSPECTOR — same kernel clearance and funded values used for hatching. */}
        {selectedEgg && (() => {
          const status = evaluateEggHatchStatus(selectedEgg, currentSettings(), simStateRef.current.organisms);
          const parent = simStateRef.current.organisms.find(org => org.id === selectedEgg.parentOrgId);
          const parentName = parent?.genome.name ?? simStateRef.current.lineage.get(selectedEgg.parentOrgId)?.name;
          const progress = Math.round(Math.min(1, selectedEgg.incubationProgress) * 100);
          const totalFunding = selectedEgg.fundedStructural + selectedEgg.fundedReserve;
          return (
            <div ref={eggDraggable.panelRef} data-testid="egg-inspector"
              onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}
              style={{transform: `translate3d(${eggDraggable.pos.x}px, ${eggDraggable.pos.y}px, 0)`, pointerEvents: 'auto'}}
              className="vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-xl border border-amber-500/60 rounded-2xl p-3 w-80 max-w-[calc(100%-1rem)] font-mono text-xs shadow-2xl z-40 pointer-events-auto">
              <div {...eggDraggable.headerProps} className="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-2 touch-none cursor-grab active:cursor-grabbing select-none">
                <span className="text-amber-300 font-bold">🥚 EGG INSPECTOR</span>
                <button type="button" title="Close egg inspector"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {e.stopPropagation(); setSelectedEggId(null); ignoreCanvasClickUntilRef.current = Date.now() + 400;}}
                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"><X size={15}/></button>
              </div>
              <div className="space-y-1 text-slate-300">
                <div className="text-amber-100 truncate" title={selectedEgg.id}>{selectedEgg.id}</div>
                <div>Parent: <span className="text-white" title={selectedEgg.parentOrgId}>{parentName ?? selectedEgg.parentOrgId}</span></div>
                <div>Generation: <span className="text-white">{selectedEgg.genome.generation}</span></div>
                <div>Funded body: <span className="text-white">{formatJoules(selectedEgg.fundedStructural)}</span></div>
                <div>Funded hatch reserve: <span className="text-emerald-300">{formatJoules(selectedEgg.fundedReserve)}</span></div>
                <div>Total funded energy: <span className="text-white">{formatJoules(totalFunding)}</span></div>
                <div>Body requirement: <span className="text-white">{formatJoules(selectedEgg.genome.bodyCost)}</span></div>
                <div>Inherited future egg reserve fraction: <span className="text-white">{Math.round(selectedEgg.genome.eggReserveFraction * 100)}%</span></div>
                <div className="pt-1">Incubation: <span className="text-amber-200">{progress}%</span> · {selectedEgg.totalIncubationTime.toFixed(1)}s total</div>
                <div className="bg-slate-950 rounded-full h-1.5 border border-slate-700 overflow-hidden">
                  <div className="h-full bg-amber-400" style={{width: `${progress}%`}} />
                </div>
                <div className="pt-1 text-amber-200 font-semibold" data-testid="egg-hatch-status">{status.message}</div>
              </div>
            </div>
          );
        })()}

        {/* CREATURE'S-EYE RETINAL HUD STRIP (When creature is selected) */}
        {selectedSpecimen && (
          <div style={{maxWidth: 'calc(100% - 1rem)'}} className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl px-3 py-1.5 flex items-center gap-3 z-30 font-mono text-[11px] shadow-lg">
            <div className="flex items-center gap-1.5 text-cyan-300 font-bold shrink-0">
              <Eye size={14} className="text-cyan-400" />
              <span>RETINAL VIEW:</span>
            </div>
            <div aria-label="Retinal samples" tabIndex={0} className="flex min-w-0 items-center gap-1 overflow-x-auto touch-pan-x">
              {selectedSpecimen.rayHits.map((ray, idx) => (
                <div key={idx} className="flex shrink-0 flex-col items-center">
                  <div
                    className="w-4 h-4 rounded border border-white/30 shadow-inner"
                    style={{backgroundColor: `rgb(${Math.round(ray.r * 255)}, ${Math.round(ray.g * 255)}, ${Math.round(ray.b * 255)})`}}
                    title={`Ray ${idx + 1}: ${ray.hit ? ray.objectType : 'empty space (black)'} @ ${Math.round(ray.dist)}px`}
                  />
                  <span className="text-[8px] text-slate-400 mt-0.5">{idx + 1}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DRAGGABLE FLOATING SPECIMEN QUICK BADGE */}
        {selectedSpecimen && (() => {
          const dietInfo = getDietClassification(selectedSpecimen.genome.mouths);
          const lifeStage = getLifeStage(selectedSpecimen);
          const remainingLifespan = Math.max(0, selectedSpecimen.maxLifespan - selectedSpecimen.age);
          const isAging = lifeStage === 'Aging';
          const reproStatus = evaluateReproductionAffordability(
            selectedSpecimen,
            ecoStats.simTime,
            ecoStats.livingCount,
            ecoStats.eggCount,
            maxOrganisms,
          );

          return (
            <div ref={badgeDraggable.panelRef} data-testid="badge-window"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `translate3d(${badgeDraggable.pos.x}px, ${badgeDraggable.pos.y}px, 0)`,
                pointerEvents: 'auto',
              }}
              className={`vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-md border rounded-2xl p-3 w-80 text-xs font-mono shadow-2xl flex flex-col gap-1.5 pointer-events-auto z-30 transition-colors ${
                isAging
                  ? 'border-amber-500/80 shadow-amber-500/20 ring-1 ring-amber-400/40'
                  : 'border-cyan-500/40 shadow-cyan-500/10'
              }`}>
              <div
                {...badgeDraggable.headerProps}
                className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-1.5 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none">
                <div
                  className="flex items-center gap-1.5 font-bold text-cyan-300 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsBrainInspectorOpen(true);
                    gameAudio.playCrispClick();
                  }}>
                  <GripHorizontal size={14} className="text-slate-500" />
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{backgroundColor: hsl(selectedSpecimen.genome.hue, 90, 60)}}
                  />
                  <span>{selectedSpecimen.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      saveCurrentSpecimenToBank();
                    }}
                    title="Save to Specimen Bank"
                    className="text-[10px] px-1.5 py-0.5 rounded border bg-purple-950/60 border-purple-500/40 text-purple-300 hover:bg-purple-900/50">
                    <Save size={11} className="inline mr-0.5" />
                    Save
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsBrainInspectorOpen((prev) => !prev);
                      gameAudio.playCrispClick();
                    }}
                    className="text-[10px] px-1.5 py-0.5 rounded border bg-cyan-950/60 border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/50">
                    Inspect
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsAutoTracking((prev) => !prev);
                    }}
                    className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                      isAutoTracking
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-800 border-slate-600 text-slate-400'
                    }`}>
                    {isAutoTracking ? 'Track' : 'Free'}
                  </button>
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      closeInspector(e);
                    }}
                    title="Deselect creature (✕)"
                    className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700">
                    ✕
                  </button>
                </div>
              </div>

              {/* Life Stage & Aging Banner */}
              <div className="flex items-center justify-between gap-1 text-[10px]">
                <span className="text-slate-400">Life Stage:</span>
                <span
                  className={`px-2 py-0.5 rounded-full border font-bold text-[10px] flex items-center gap-1 ${
                    lifeStage === 'Juvenile'
                      ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                      : lifeStage === 'Adult'
                      ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300'
                      : lifeStage === 'Aging'
                      ? 'bg-amber-950/90 border-amber-500/70 text-amber-300 animate-pulse'
                      : 'bg-slate-900 border-slate-700 text-slate-500'
                  }`}>
                  {lifeStage === 'Juvenile' && '🌱 Juvenile'}
                  {lifeStage === 'Adult' && '👑 Adult'}
                  {lifeStage === 'Aging' && '⚠️ Aging (Senescent)'}
                  {lifeStage === 'Deceased' && '💀 Deceased'}
                </span>
              </div>

              {isAging && (
                <div className="bg-amber-950/50 border border-amber-500/40 rounded-lg p-1.5 text-[9px] text-amber-300 flex items-center gap-1">
                  <AlertTriangle size={12} className="text-amber-400 shrink-0" />
                  <span>Approaching max lifespan ({remainingLifespan.toFixed(1)}s remaining)</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-slate-300 pt-0.5">
                <div>Gen: <span className="text-white font-bold">{selectedSpecimen.genome.generation}</span></div>
                <div>Lineage: <span className="text-amber-300 font-bold truncate inline-block max-w-[100px] align-bottom">{selectedSpecimen.genome.archetype || 'Genesis'}</span></div>
                <div className="col-span-2">
                  Diet: <span className={`${dietInfo.textClass} font-bold`}>{dietInfo.label} {dietInfo.icon}</span>
                </div>
                <div className="col-span-2">
                  Age: <span className="text-cyan-300 font-bold">{selectedSpecimen.age.toFixed(1)}s</span> / {selectedSpecimen.maxLifespan.toFixed(0)}s <span className="text-slate-500">({remainingLifespan.toFixed(1)}s left)</span>
                </div>
                <div>DNA Clutch: <span className="text-amber-300 font-bold">{selectedSpecimen.genome.targetClutchSize || 2} eggs</span></div>
                <div>Maturity: <span className="text-emerald-300 font-bold">{(selectedSpecimen.genome.maturityAge || 20.0).toFixed(1)}s</span></div>
                <div>Organs: <span className="text-cyan-300 font-bold">{selectedSpecimen.genome.mouths.length}M · {selectedSpecimen.genome.eyes.length}E</span></div>
                <div>Biomass: <span className="text-purple-300 font-bold">{formatJoules(selectedSpecimen.structuralBiomass)}</span></div>
                <div>Clutches: <span className="text-amber-300 font-bold">{selectedSpecimen.clutchesLaid || 0} ({selectedSpecimen.offspringCount} eggs)</span></div>
                <div>Food Eaten: <span className="text-emerald-400 font-bold">{selectedSpecimen.foodEaten || 0}</span></div>
              </div>

              {/* Reproduction Status Pill (Disambiguated from Life Stage) */}
              <div className="mt-1 pt-1 border-t border-slate-800">
                <div className="flex justify-between items-center text-[10px] mb-1">
                  <span className="text-slate-400 font-bold">Reproduction:</span>
                  <span className={`px-2 py-0.5 rounded border text-[9px] ${reproStatus.badgeClass}`}>
                    {reproStatus.statusText}
                  </span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>Reserve: {formatJoules(selectedSpecimen.energy)} / {formatJoules(selectedSpecimen.genome.maxEnergyCapacity)}</span>
                  <span>Reserve Floor: {formatJoules(reproStatus.parentReserve)}</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Next egg: {formatJoules(reproStatus.eggCost)}</span>
                  <span>Hatch reserve: {formatJoules(getEggReserveFunding(selectedSpecimen.genome))}</span>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-700">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-150"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (selectedSpecimen.energy / Math.max(1, selectedSpecimen.genome.maxEnergyCapacity)) * 100),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}

        {/* TOAST NOTIFICATION BADGE */}
        {saveNotification && (
          <div className="pointer-events-none absolute top-14 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-900/90 to-emerald-900/90 border border-emerald-400 backdrop-blur-md rounded-2xl px-4 py-2 flex items-center gap-2 z-50 font-mono text-xs font-bold text-emerald-300 shadow-2xl animate-bounce">
            <CheckCircle2 size={16} className="text-emerald-400" />
            <span>{saveNotification}</span>
          </div>
        )}

        {/* DRAGGABLE SETTINGS & "BRANCH THIS ECOSYSTEM" PANEL */}
        {isSettingsOpen && (
          <div ref={settingsDraggable.panelRef} data-testid="settings-window"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate3d(${settingsDraggable.pos.x}px, ${settingsDraggable.pos.y}px, 0)`,
              pointerEvents: 'auto',
            }}
            className="vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-lg border border-amber-500/50 rounded-2xl p-4 w-[352px] flex flex-col font-mono text-xs shadow-2xl z-40 pointer-events-auto">
            <div
              {...settingsDraggable.headerProps}
              className="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-3 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <GripHorizontal className="text-amber-400" size={16} />
                <Sliders className="text-amber-400" size={16} />
                <span className="font-bold text-amber-300 text-sm">ENVIRONMENT & BRANCHING</span>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsSettingsOpen(false);
                  gameAudio.playCrispClick();
                }}
                title="Close settings (✕)"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 flex-1 min-h-0 overflow-y-auto pr-1">
              {/* Branch Ecosystem Button */}
              <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/40 space-y-2">
                <div className="flex items-center gap-1.5 text-purple-300 font-bold">
                  <Split size={15} />
                  <span>Branch this Ecosystem</span>
                </div>
                <p className="text-[10px] text-slate-300 leading-tight">
                  Snapshots the live world and forks a parallel branch to explore environmental changes.
                </p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={customBranchName}
                    onChange={(e) => setCustomBranchName(e.target.value)}
                    className="flex-1 bg-slate-950 border border-purple-500/40 rounded px-2 py-1 text-[11px] text-white"
                  />
                  <button
                    onClick={branchEcosystem}
                    className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded text-[11px]">
                    Fork
                  </button>
                </div>
              </div>

              {/* Inflow Rate */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300 text-[11px]">
                  <span className="font-bold text-purple-300">Nutrient Inflow Rate:</span>
                  <span className="text-purple-400 font-bold">
                    {nutrientInflowRate === 0 ? '0.0 items/s (Disabled)' : `${nutrientInflowRate.toFixed(1)} items/s`}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="150"
                  step="1"
                  value={nutrientInflowRate}
                  onChange={(e) => setNutrientInflowRate(parseFloat(e.target.value))}
                  className="w-full h-2 accent-purple-400 cursor-pointer bg-slate-950 rounded-lg"
                />
              </div>

              {/* Target Abundance */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300 text-[11px]">
                  <span>Nutrient Target Abundance:</span>
                  <span className="text-emerald-300 font-bold">{targetNutrientAbundance}</span>
                </div>
                <input
                  type="range"
                  aria-label="Nutrient target"
                  min="0"
                  max="800"
                  step="1"
                  value={targetNutrientAbundance}
                  onChange={(e) => setTargetNutrientAbundance(parseInt(e.target.value, 10))}
                  className="w-full h-2 accent-emerald-400 cursor-pointer bg-slate-950 rounded-lg"
                />
              </div>

              <p className="text-[10px] text-slate-400">Limit applies to inflow, Feed and Feed All. Existing food remains until eaten or cleared; remains keep their stored energy.</p>
              <button className="w-full py-1.5 bg-slate-800 border border-emerald-500/40 rounded-xl text-emerald-300 text-[11px]"
                onClick={() => {
                  clearFreeNutrients(simStateRef.current);
                  setSaveNotification('Free nutrients cleared; removed energy recorded.');
                  setTimeout(() => setSaveNotification(null), 2500);
                }}>Clear Free Nutrients</button>
              <div>
                <label className="flex justify-between text-[11px] text-slate-300">Tank Width <strong>{worldWidth} px</strong></label>
                <input aria-label="Tank width" type="range" min="800" max="4800" step="100" value={worldWidth}
                  onChange={e => changeTankSize(Number(e.target.value), worldHeight)} className="w-full h-2 accent-cyan-400" />
              </div>
              <div>
                <label className="flex justify-between text-[11px] text-slate-300">Tank Height <strong>{worldHeight} px</strong></label>
                <input aria-label="Tank height" type="range" min="600" max="3000" step="100" value={worldHeight}
                  onChange={e => changeTankSize(worldWidth, Number(e.target.value))} className="w-full h-2 accent-cyan-400" />
              </div>
              <div>
                <label className="flex justify-between text-[11px] text-slate-300">Vertical Gravity <strong>{gravity} px/s²</strong></label>
                <input aria-label="Gravity" type="range" min="-200" max="200" step="5" value={gravity}
                  onChange={e => setGravity(Number(e.target.value))} className="w-full h-2 accent-cyan-400" />
              </div>
              <div>
                <label className="flex justify-between text-[11px] text-slate-300">Maximum Living Creatures <strong>{maxOrganisms}</strong></label>
                <input aria-label="Maximum living creatures" type="range" min="1" max="150" step="1" value={maxOrganisms}
                  onChange={e => setMaxOrganisms(Number(e.target.value))} className="w-full h-2 accent-purple-400" />
                <p className="text-[10px] text-slate-400">Lowering the cap stops additions; existing creatures continue living.</p>
              </div>
              <div className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <label htmlFor="simulation-seed">Seed for Next Reset</label>
                <input id="simulation-seed" type="number" min="0" max="4294967295" value={simulationSeed}
                  onChange={e => setSimulationSeed(Number(e.target.value) >>> 0)} className="w-28 bg-slate-950 border border-slate-700 rounded px-2 py-1" />
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <label htmlFor="founder-mode">New Founder Brains</label>
                <select id="founder-mode" value={founderMode} onChange={e => setFounderMode(e.target.value as FounderMode)}
                  className="w-full bg-slate-950 border border-purple-500/40 rounded px-2 py-1">
                  <option value="balanced">Balanced — swimming + weak sensory steering</option>
                  <option value="unbiased">Unbiased — swimming + random neural weights</option>
                </select>
                <p className="text-[10px] text-slate-400">Affects future founders. Both modes evolve their controllers; neither is trained.</p>
              </div>

              {/* Water Viscosity */}
              <div>
                <div className="flex justify-between items-center mb-1 text-slate-300 text-[11px]">
                  <span>Water Viscosity (&mu;):</span>
                  <span className="text-cyan-300 font-bold">{waterViscosity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.00"
                  max="0.6"
                  step="0.01"
                  value={waterViscosity}
                  onChange={(e) => setWaterViscosity(parseFloat(e.target.value))}
                  className="w-full h-2 accent-cyan-400 cursor-pointer bg-slate-950 rounded-lg"
                />
              </div>

              {/* Kinship & Traces */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] text-slate-300 font-bold">Kinship Protection:</span>
                <button
                  onClick={() => setKinshipProtectionEnabled((prev) => !prev)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    kinshipProtectionEnabled
                      ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                  }`}>
                  {kinshipProtectionEnabled ? 'Protected (On)' : 'Natural (Off)'}
                </button>
              </div>

              <p className="text-[10px] text-slate-400">Protection covers living parents, offspring, siblings and related eggs. Unrelated creatures of the same generation remain edible; remains are unprotected animal food.</p>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] text-slate-300 font-bold">Movement Traces:</span>
                <button
                  onClick={() => setShowTraces((prev) => !prev)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    showTraces
                      ? 'bg-cyan-600/30 border-cyan-400 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                  {showTraces ? 'Visible' : 'Hidden'}
                </button>
              </div>

              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[11px] text-slate-300 font-bold">Mouth Apertures:</span>
                <button
                  onClick={() => setShowMouthApertures((prev) => !prev)}
                  className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${
                    showMouthApertures
                      ? 'bg-emerald-600/30 border-emerald-400 text-emerald-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}>
                  {showMouthApertures ? 'Visible' : 'Hidden'}
                </button>
              </div>

              <button onClick={copyDiagnosticReport} className="w-full py-1.5 bg-slate-800 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold text-[11px]">Copy Diagnostic Report</button>
              {reportText && <textarea aria-label="Diagnostic report" readOnly value={reportText} onFocus={e => e.currentTarget.select()}
                className="w-full h-24 bg-slate-950 border border-cyan-900 rounded p-2 text-[10px] text-slate-300" />}
              {/* Persistence: Export & Import JSON */}
              <div className="pt-2 border-t border-slate-800 flex gap-2">
                <button
                  onClick={exportEcosystemJSON}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 rounded-xl font-bold flex items-center justify-center gap-1 text-[11px]">
                  <Download size={13} />
                  Export Snapshot
                </button>
                <label className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold flex items-center justify-center gap-1 text-[11px] cursor-pointer">
                  <Upload size={13} />
                  Import Snapshot
                  <input type="file" accept=".json" onChange={importEcosystemJSON} className="hidden" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* SPECIMEN BANK MODAL */}
        {isSpecimenBankOpen && (
          <div ref={bankDraggable.panelRef} data-testid="bank-window"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate3d(${bankDraggable.pos.x}px, ${bankDraggable.pos.y}px, 0)`,
              pointerEvents: 'auto',
            }}
            className="vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-xl border-2 border-purple-500/50 rounded-3xl p-4 w-96 flex flex-col font-mono text-xs shadow-2xl z-40 pointer-events-auto">
            <div
              {...bankDraggable.headerProps}
              className="flex items-center justify-between border-b border-purple-500/30 pb-2 mb-3 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none shrink-0">
              <div className="flex items-center gap-2">
                <GripHorizontal className="text-purple-400" size={16} />
                <FolderOpen className="text-purple-400" size={16} />
                <span className="font-bold text-purple-300 text-sm">SPECIMEN BANK</span>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsSpecimenBankOpen(false);
                  gameAudio.playCrispClick();
                }}
                title="Close specimen bank (✕)"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2 mb-2 text-[10px] shrink-0">
              <div className="text-purple-300">{FEATURED_BLUEPRINTS.length} featured · {FOUNDER_BLUEPRINTS.length} legacy · {specimenBank.length} saved</div>
              <select aria-label="Bank collection" value={bankSection} onChange={e => setBankSection(e.target.value as typeof bankSection)}
                className="w-full bg-slate-950 border border-purple-900 rounded px-2 py-1 text-purple-200">
                <option value="featured">Featured starters ({FEATURED_BLUEPRINTS.length})</option>
                <option value="legacy">Legacy designs ({FOUNDER_BLUEPRINTS.length})</option>
                <option value="saved">My saved specimens ({specimenBank.length})</option>
                <option value="all">All specimens</option>
              </select>
              <input aria-label="Search specimens" placeholder="Search creatures…" value={bankSearch} onChange={e => setBankSearch(e.target.value)} className="w-full bg-slate-950 border border-purple-900 rounded px-2 py-1" />
              <div className="flex gap-2">
                <select aria-label="Body family" value={bankFamily} onChange={e => setBankFamily(e.target.value)} className="min-w-0 flex-1 bg-slate-950 border border-purple-900 rounded px-1 py-1">
                  <option value="All">All families</option>{FOUNDER_FAMILIES.map(f => <option key={f}>{f}</option>)}
                </select>
                <select aria-label="Diet filter" value={bankDiet} onChange={e => setBankDiet(e.target.value)} className="bg-slate-950 border border-purple-900 rounded px-1 py-1">
                  <option value="All">All diets</option>{['herbivore', 'omnivore', 'carnivore'].map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <button onClick={() => {initGame('showcase'); setIsSpecimenBankOpen(false);}} className="w-full py-1 border border-purple-500/40 rounded text-purple-300">Reset with Featured Showcase ({FEATURED_BLUEPRINTS.length})</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
              {displayedSpecimenBank.length === 0 ? (
                <div className="p-6 text-center text-slate-500">
                  No specimens match these filters.
                </div>
              ) : (
                displayedSpecimenBank.map((item) => (
                  <div key={item.id} data-testid="specimen-row" data-builtin={item.id.startsWith('FOUNDER-')} className="p-2.5 bg-slate-950/80 rounded-xl border border-purple-900/40 flex items-center justify-between gap-2">
                    <CreaturePreview genome={item.genome} />
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: hsl(item.genome.hue, 90, 60)}} />
                        <span>{item.name}</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {item.tags.join(' · ')} · {item.savedAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addPrimordialSpecimen('random', item.genome)}
                        className="px-2 py-1 bg-emerald-600/30 hover:bg-emerald-500/40 border border-emerald-400/50 text-emerald-300 font-bold rounded text-[10px]">
                        Spawn
                      </button>
                      {!item.id.startsWith('FOUNDER-') && (
                      <button
                        onClick={() => {
                          const updated = specimenBank.filter((b) => b.id !== item.id);
                          setSpecimenBank(updated);
                          localStorage.setItem('vida_specimen_bank_v3', JSON.stringify(updated));
                        }}
                        className="px-1.5 py-1 text-slate-500 hover:text-rose-400 text-[10px]">
                        ✕
                      </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* DRAGGABLE BRAIN, MORPHOLOGY, ENERGY, LINEAGE & VERIFICATION INSPECTOR */}
        {isBrainInspectorOpen && selectedSpecimen && (
          <div ref={inspectorDraggable.panelRef} data-testid="creature-inspector"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate3d(${inspectorDraggable.pos.x}px, ${inspectorDraggable.pos.y}px, 0)`,
              pointerEvents: 'auto',
            }}
            className="vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-xl border-2 border-cyan-500/50 rounded-3xl p-4 w-96 md:w-[500px] flex flex-col font-mono text-xs shadow-2xl z-40 pointer-events-auto">
            {/* Draggable Header */}
            <div
              {...inspectorDraggable.headerProps}
              className="flex items-center justify-between border-b border-cyan-500/30 pb-2 mb-2 shrink-0 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <GripHorizontal className="text-cyan-400" size={18} />
                <Network className="text-cyan-400" size={18} />
                <span className="font-bold text-cyan-300 text-sm">
                  RECURRENT BRAIN & DIAGNOSTICS
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${getDietClassification(selectedSpecimen.genome.mouths).badgeClass}`}>
                  {getDietClassification(selectedSpecimen.genome.mouths).label}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">{selectedSpecimen.id}</span>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setIsBrainInspectorOpen(false);
                    gameAudio.playCrispClick();
                  }}
                  title="Close Diagnostics Window (✕)"
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Tab Selector */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-cyan-900/50 mb-3 shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setInspectorActiveTab('brain'); }}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  inspectorActiveTab === 'brain' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                <Network size={12} />
                <span>Brain</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setInspectorActiveTab('morphology'); }}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  inspectorActiveTab === 'morphology' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                <Layers size={12} />
                <span>Anatomy</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setInspectorActiveTab('energy'); }}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  inspectorActiveTab === 'energy' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                <Gauge size={12} />
                <span>Energy</span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setInspectorActiveTab('lineage'); }}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  inspectorActiveTab === 'lineage' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                <GitBranch size={12} />
                <span>Tree</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setInspectorActiveTab('verification');
                  if (!diagnosticResults.ran && !diagnosticsRunning) runDiagnosticSuite();
                }}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1 ${
                  inspectorActiveTab === 'verification' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}>
                <ShieldCheck size={12} />
                <span>Verify</span>
              </button>
            </div>

            {/* TAB 1: RECURRENT BRAIN & SYNAPSES */}
            {inspectorActiveTab === 'brain' && (
              <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
                <div className="flex justify-between items-center px-1 text-[10px] text-slate-400">
                  <span>Pruning Threshold: <strong className="text-cyan-400">{synapsePruningThreshold.toFixed(2)}</strong></span>
                  <input
                    type="range"
                    min="0"
                    max="0.8"
                    step="0.01"
                    value={synapsePruningThreshold}
                    onChange={(e) => setSynapsePruningThreshold(parseFloat(e.target.value))}
                    className="w-28 h-1.5 accent-cyan-400 cursor-pointer bg-slate-950 rounded"
                  />
                </div>

                <div className="w-full bg-slate-950/90 rounded-2xl p-2 border border-cyan-500/30 flex flex-col items-center shrink-0">
                  <div className="w-full flex justify-between text-[10px] text-slate-400 px-2 mb-1">
                    <span className="text-cyan-400 font-bold">{selectedSpecimen.neuralInputs.length} SENSORY</span>
                    <span className="text-purple-400 font-bold">{selectedSpecimen.neuralHidden.length} RECURRENT HIDDEN (h_t)</span>
                    <span className="text-amber-400 font-bold">6-CH MOTORS</span>
                  </div>
                  <div className="px-2 mb-1 text-[10px] text-slate-500 self-start" data-testid="brain-topology">
                    {enabledBrainEdgeCount(selectedSpecimen.genome).toLocaleString()} enabled connections
                    {selectedSpecimen.genome.disabledConnections?.length
                      ? ` · ${selectedSpecimen.genome.disabledConnections.length.toLocaleString()} disabled` : ''}
                  </div>

                  <div className="px-2 mb-1 text-[10px] text-slate-500 self-start" data-testid="brain-memory">
                    {selectedSpecimen.genome.hiddenTimeConstants!.filter(tau => tau > 0).length} neurons with slow memory
                    {' · '}max τ {Math.max(0, ...selectedSpecimen.genome.hiddenTimeConstants!).toFixed(2)} s
                    {' · '}memory upkeep {memoryUpkeep(selectedSpecimen.genome).toFixed(2)} J/s
                  </div>
                  {(() => {
                    const injuryIndex = selectedSpecimen.genome.inputKeys?.indexOf('body:injury') ?? -1;
                    if (injuryIndex < 0) return null;
                    const actualConnections = selectedSpecimen.genome.weightsIH.reduce((n, row, h) =>
                      n + Number(Math.abs(row[injuryIndex] ?? 0) > 1e-10
                        && !selectedSpecimen.genome.disabledConnections?.includes(
                          brainEdgeKey('ih', selectedSpecimen.genome.hiddenIds![h], 'body:injury'))), 0);
                    return (
                      <div className="px-2 mb-1 text-[10px] text-slate-400 self-start" data-testid="injury-telemetry"
                        title="The injury signal comes only from actual energy removed by biting mouths. The pending energy will be sensed on the next neural update; a wired neuron does not guarantee escape.">
                        Bite signal {(selectedSpecimen.neuralInputs[injuryIndex] ?? 0).toFixed(2)} / 1
                        {' · '}queued {formatJoules(selectedSpecimen.biteFeedbackJ ?? 0)}
                        {' · '}{actualConnections} active injury-input synapses
                      </div>
                    );
                  })()}
                  <div className="w-full px-2 pb-2 text-[10px] text-slate-400" data-testid="motor-telemetry">
                    {selectedSpecimen.joints.map((j, i) => <span key={selectedSpecimen.genome.parts[i + 1].id} className="inline-block mr-3">
                      J{i + 1}: stroke {Math.round((j.amplitude ?? 1) * 100)}% · engaged {Math.round((j.engagement ?? 1) * 100)}%
                    </span>)}
                  </div>
                  <div className="w-full max-h-24 overflow-y-auto px-2 pb-2 text-[10px] text-slate-400" data-testid="joint-motor-genetics">
                    {selectedSpecimen.genome.parts.slice(1).map((part, i) => (
                      <div key={part.id} title="Inherited oscillator contribution (0% = pure brain-controlled posture). Harmonics alter the wave smoothly, without adding thrust.">
                        J{i + 1} · rhythm {Math.round((part.oscillatorMix ?? 1) * 100)}%
                        {' · '}{part.waveHarmonics?.some(c => c !== 0)
                          ? `harmonics [${part.waveHarmonics.map(c => c.toFixed(2)).join(', ')}]`
                          : 'sine'}
                        {part.oscillatorMix === undefined && part.waveHarmonics === undefined ? ' (classic controller)' : ''}
                      </div>
                    ))}
                  </div>
                  <BrainGraph organism={selectedSpecimen} threshold={synapsePruningThreshold} />
                </div>
              </div>
            )}

            {/* TAB 2: ANATOMY */}
            {inspectorActiveTab === 'morphology' && (() => {
              const diet = getDietClassification(selectedSpecimen.genome.mouths);
              return (
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1">
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-cyan-900/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] text-cyan-400 font-bold tracking-wider">
                      <span>DISCRETE NxM MORPHOLOGY</span>
                      <span className="text-white">{selectedSpecimen.genome.parts.length} PARTS</span>
                    </div>

                    <div className="p-2 rounded-lg bg-slate-900/90 border border-cyan-500/30 flex items-center justify-between text-[11px]">
                      <div>
                        <div className="text-slate-400 text-[10px]">Diet Classification:</div>
                        <div className={`${diet.textClass} font-bold text-xs flex items-center gap-1 mt-0.5`}>
                          <span>{diet.icon}</span>
                          <span>{diet.label}</span>
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400">
                        <div>Composition:</div>
                        <div className="text-white font-bold">{diet.composition}</div>
                      </div>
                    </div>

                    {/* Heritable Genetic Traits */}
                    <div className="p-2 rounded-lg bg-slate-900/90 border border-purple-500/30 space-y-1 text-[10px]">
                      <div className="text-purple-300 font-bold flex items-center gap-1">
                        <Dna size={12} />
                        <span>HERITABLE REPRODUCTION DNA TRAITS</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-300 pt-0.5">
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                          <div className="text-slate-400 text-[9px]">Target Clutch Size:</div>
                          <div className="text-amber-300 font-bold text-xs">{selectedSpecimen.genome.targetClutchSize || 2} eggs</div>
                          <div className="text-[8px] text-slate-500">Mutates &plusmn;1 (Range 1-6)</div>
                        </div>
                        <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                          <div className="text-slate-400 text-[9px]">Sexual Maturity Age:</div>
                          <div className="text-emerald-300 font-bold text-xs">{(selectedSpecimen.genome.maturityAge || 20.0).toFixed(1)}s</div>
                          <div className="text-[8px] text-slate-500">Mutates &plusmn;1-3s (Range 10-45s)</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      {selectedSpecimen.genome.parts.map((p, idx) => (
                        <div key={idx} className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 flex justify-between items-center text-[10px]">
                          <div>
                            <span className="font-bold text-cyan-300">Part {idx}</span>
                            <span className="text-[9px] text-slate-400 ml-2">
                              {idx === 0 ? 'Root Center of Mass' : `Attached ${p.attachmentPoint} to #${p.parentIndex}`}
                            </span>
                          </div>
                          <div className="text-right">
                            <div className="text-amber-300 font-bold text-xs">{p.dimN}&times;{p.dimM}</div>
                            <div className="text-[9px] text-slate-500">({Math.round(p.width)}&times;{Math.round(p.height)}px)</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-1 pt-2 border-t border-slate-800 space-y-1 text-[10px]">
                      <div className="font-bold text-cyan-400">EYES ({selectedSpecimen.genome.eyes.length})</div>
                      <div className="text-slate-400">A face holds one body connection or up to three organs.</div>
                      {selectedSpecimen.genome.eyes.map((eye, i) => <div key={eye.id} className="text-slate-300">
                        Eye #{i + 1}: Part {eye.partIndex}, {eye.direction}, {organSlotLabel(eye)}
                      </div>)}
                    </div>

                    {/* Detailed Per-Mouth Telemetry & Rules */}
                    <div className="mt-1 pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="text-[10px] font-bold text-cyan-400 tracking-wider">
                        MOUTH APERTURES & DIET PERMISSIONS ({selectedSpecimen.genome.mouths.length})
                      </div>
                      {selectedSpecimen.genome.mouths.map((m, idx) => {
                        const isCarn = m.mouthType === 'carnivore';
                        const isOmni = m.mouthType === 'omnivore';
                        const typeLabel = isCarn ? 'Carnivore 🥩' : isOmni ? 'Omnivore 🟣' : 'Herbivore 🌿';
                        const typeBadge = isCarn
                          ? 'bg-rose-950/80 border-rose-500/40 text-rose-300'
                          : isOmni
                          ? 'bg-purple-950/80 border-purple-500/40 text-purple-300'
                          : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300';
                        const rules = isCarn
                          ? 'Permitted: Prey, Eggs, Remains. Kin protection applies to living prey and eggs when enabled. Rejected: Plant Nutrients.'
                          : isOmni
                          ? 'Permitted: Plant Nutrients, Prey, Eggs, Remains (at 50% specialist rate). Kin protection applies when enabled.'
                          : 'Permitted: Plant Nutrients ONLY. Rejected: Prey, Eggs, Remains.';
                        return (
                          <div key={m.id || idx} className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[10px] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white">Mouth #{idx + 1} (Part {m.partIndex}, {m.direction}, {organSlotLabel(m)})</span>
                              <span className={`px-1.5 py-0.5 rounded border text-[9px] font-bold ${typeBadge}`}>
                                {typeLabel}
                              </span>
                            </div>
                            <div className="text-[9px] text-slate-400">
                              Aperture Width: <strong className="text-cyan-300">{m.intakeWidth.toFixed(1)}px</strong> · Contact Radius: <strong className="text-cyan-300">{(isCarn ? 4.5 : isOmni ? 4.0 : 3.5).toFixed(1)}px</strong>
                            </div>
                            <div className="text-[9px] text-slate-300 italic">
                              {rules}
                              <div>Transfer limit: {isOmni ? OMNIVORE_EAT_RATE : CONTINUOUS_EAT_RATE} J/s · Absorbs 80% (68% from remains).</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* TAB 3: ENERGY */}
            {inspectorActiveTab === 'energy' && (() => {
              const diet = getDietClassification(selectedSpecimen.genome.mouths);
              const lifeStage = getLifeStage(selectedSpecimen);
              const remainingLifespan = Math.max(0, selectedSpecimen.maxLifespan - selectedSpecimen.age);
              const isAging = lifeStage === 'Aging';
              const reproEval = evaluateReproductionAffordability(
                selectedSpecimen,
                ecoStats.simTime,
                ecoStats.livingCount,
                ecoStats.eggCount,
                maxOrganisms,
              );

              const totalBurnRate = Math.max(
                0.1,
                (selectedSpecimen.basalEnergyRate || 12) +
                (selectedSpecimen.sensoryEnergyRate || 11) +
                (selectedSpecimen.motorEnergyRate || 0)
              );
              const estimatedReserveEndurance = selectedSpecimen.energy / totalBurnRate;

              return (
                <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1 text-[11px]">
                  {/* Aging Banner in Energy Tab if senescent */}
                  {isAging && (
                    <div className="bg-amber-950/80 border-2 border-amber-500/70 rounded-xl p-2.5 text-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-400 shrink-0 animate-bounce" />
                        <div>
                          <div className="font-bold text-amber-300">SENESCENCE PHASE ACTIVE</div>
                          <div className="text-[10px] text-amber-200/80">
                            Age: {selectedSpecimen.age.toFixed(1)}s / {selectedSpecimen.maxLifespan.toFixed(0)}s ({remainingLifespan.toFixed(1)}s until natural old age dissolution)
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-900 border border-amber-400 text-amber-100 font-bold text-[10px]">
                        Aging
                      </span>
                    </div>
                  )}

                  <div className="bg-slate-950/80 rounded-xl p-3 border border-amber-900/40 space-y-1.5">
                    <div className="flex items-center justify-between text-amber-400 font-bold text-[10px] tracking-wider">
                      <span>THERMODYNAMIC BUDGET & METABOLIC CALIBRATION</span>
                      <span className={`px-1.5 py-0.5 rounded border text-[9px] ${diet.badgeClass}`}>
                        {diet.label}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Life Stage & Chronological Age:</span>
                      <span className="font-bold text-white">
                        {lifeStage} · {selectedSpecimen.age.toFixed(1)}s / {selectedSpecimen.maxLifespan.toFixed(0)}s ({remainingLifespan.toFixed(1)}s remaining)
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>DNA Target Clutch / Maturity:</span>
                      <span className="text-amber-300 font-bold">
                        {selectedSpecimen.genome.targetClutchSize || 2} eggs · {(selectedSpecimen.genome.maturityAge || 20.0).toFixed(1)}s maturity
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300">
                      <span>Structural Biomass:</span>
                      <span className="text-purple-300 font-bold">{formatJoules(selectedSpecimen.structuralBiomass)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Geometric Body Area:</span>
                      <span className="text-cyan-300 font-bold">
                        {calculateTotalBodyArea(selectedSpecimen.genome.parts)} units² ({(calculateTotalBodyArea(selectedSpecimen.genome.parts) / BASE_FOUNDER_AREA).toFixed(2)}&times; founder)
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Usable Energy Reserve:</span>
                      <span className="text-emerald-400 font-bold">{formatJoules(selectedSpecimen.energy)} / {formatJoules(selectedSpecimen.genome.maxEnergyCapacity)}</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Mandatory Survival Reserve Floor:</span>
                      <span className="text-slate-400 font-bold">{formatJoules(reproEval.parentReserve)} (max(2kJ, 20% cap))</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Available for Egg Budget:</span>
                      <span className={reproEval.availableForReproduction >= reproEval.eggCost ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                        {formatJoules(Math.max(0, reproEval.availableForReproduction))} (Egg Cost: {formatJoules(reproEval.eggCost)})
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300" title="Inherited multiplier of the world mutation probability for body color. Zero preserves pigment in the next offspring.">
                      <span>Inherited Color Variability:</span>
                      <span className="text-cyan-300 font-bold">{Math.round((selectedSpecimen.genome.colorMutationRate ?? 1) * 100)}%</span>
                    </div>
                    <div className="border-t border-slate-800 pt-1 text-[10px] text-slate-400 font-bold">METABOLIC EXPENDITURE BREAKDOWN (J/s):</div>
                    <div className="flex justify-between text-slate-300 pl-2">
                      <span>• Basal Maintenance:</span>
                      <span className="text-rose-300 font-bold">
                        {(selectedSpecimen.basalEnergyRate ?? (BASAL_METABOLIC_RATE * (calculateTotalBodyArea(selectedSpecimen.genome.parts) / BASE_FOUNDER_AREA) * selectedSpecimen.genome.metabolicEfficiency)).toFixed(2)} J/s
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300 pl-2">
                      <span>• Sensory & Neural:</span>
                      <span className="text-indigo-300 font-bold">
                        {(selectedSpecimen.sensoryEnergyRate ?? Math.max(0,
                          SENSORY_NEURAL_METABOLIC_RATE * (selectedSpecimen.genome.eyes.length * 5 + selectedSpecimen.neuralHidden.length + selectedSpecimen.genome.mouths.length * 2)
                          + NEURAL_EDGE_METABOLIC_RATE * (enabledBrainEdgeCount(selectedSpecimen.genome)
                            - NUM_HIDDEN * (selectedSpecimen.neuralInputs.length + NUM_HIDDEN + selectedSpecimen.neuralOutputs.length))
                          + memoryUpkeep(selectedSpecimen.genome))).toFixed(2)} J/s
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300 pl-2">
                      <span>• Motor Mechanical Work:</span>
                      <span className="text-amber-300 font-bold">{(selectedSpecimen.motorEnergyRate || 0).toFixed(2)} J/s</span>
                    </div>

                    <div className="flex justify-between text-slate-200 border-t border-slate-800 pt-1">
                      <span className="font-bold">Total Net Burn Rate:</span>
                      <span className="text-orange-400 font-bold">
                        {totalBurnRate.toFixed(2)} J/s
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300 bg-emerald-950/30 p-1.5 rounded border border-emerald-500/20">
                      <span className="font-bold text-emerald-400">Estimated reserve endurance:</span>
                      <span className="text-emerald-300 font-bold font-mono">
                        {estimatedReserveEndurance.toFixed(1)}s (at net burn)
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-300 pt-1">
                      <span>Reproduction Eligibility:</span>
                      <span className={`px-2 py-0.5 rounded border text-[10px] ${reproEval.badgeClass}`}>
                        {reproEval.statusText}
                      </span>
                    </div>
                  </div>

                  {/* RECENT INGESTION LOG */}
                  <div className="bg-slate-950/80 rounded-xl p-3 border border-emerald-900/40 space-y-2">
                    <div className="flex items-center justify-between text-[10px] text-emerald-400 font-bold tracking-wider">
                      <span>RECENT INGESTION LOG</span>
                      <span className="text-slate-400 font-mono text-[9px]">Last {selectedSpecimen.recentFeedings?.length || 0} bites</span>
                    </div>

                    {(!selectedSpecimen.recentFeedings || selectedSpecimen.recentFeedings.length === 0) ? (
                      <div className="p-3 text-center text-slate-500 text-[10px] italic">
                        No contact ingestions recorded yet (organism seeking nutrients/prey)...
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {selectedSpecimen.recentFeedings.slice().reverse().map((ev, idx) => {
                          const icon = ev.foodCategory === 'Nutrient' ? '🌿' : ev.foodCategory === 'Prey' || ev.foodCategory === 'Carrion' ? '🥩' : '🥚';
                          const color = ev.foodCategory === 'Nutrient' ? 'text-emerald-400' : ev.foodCategory === 'Prey' || ev.foodCategory === 'Carrion' ? 'text-rose-400' : 'text-amber-400';
                          return (
                            <div key={idx} className="p-1.5 bg-slate-900/90 rounded border border-slate-800 flex items-center justify-between text-[10px]">
                              <div className="flex items-center gap-1.5">
                                <span>{icon}</span>
                                <span className={`font-bold ${color}`}>{ev.foodCategory}</span>
                                <span className="text-slate-400 text-[9px]">({ev.mouthType})</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-emerald-300 font-mono">+{formatJoules(ev.energyTransferred)}</span>
                                <span className="text-slate-500 text-[9px] font-mono">t={ev.timestamp.toFixed(1)}s</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* TAB 4: LINEAGE TREE & RECENT DEATHS LOG */}
            {inspectorActiveTab === 'lineage' && (
              <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto pr-1 text-[10px]">
                <div className="bg-slate-950/80 rounded-xl p-3 border border-cyan-500/40 space-y-2">
                  <div className="text-cyan-400 font-bold text-xs flex items-center justify-between">
                    <span>ANCESTOR LINEAGE & OFFSPRING</span>
                    <span className="text-slate-400 font-normal">ID: {selectedSpecimen.id}</span>
                  </div>
                  <div className="p-2 bg-slate-900/80 rounded border border-slate-800 space-y-1">
                    <div>Archetype / Name: <span className="font-bold text-white">{selectedSpecimen.genome.name || selectedSpecimen.genome.archetype || 'Specimen'}</span></div>
                    <div>Generation: <span className="font-bold text-cyan-300">{selectedSpecimen.genome.generation}</span></div>
                    <div>Direct Parents: <span className="text-slate-400">{selectedSpecimen.genome.parentIds.join(', ') || 'Primordial Genesis'}</span></div>
                    <div>DNA Traits: <span className="text-amber-300 font-bold">{selectedSpecimen.genome.targetClutchSize || 2} eggs clutch</span> &middot; <span className="text-emerald-300 font-bold">{(selectedSpecimen.genome.maturityAge || 20.0).toFixed(1)}s maturity</span></div>
                    <div>Total Offspring: <span className="font-bold text-emerald-400">{selectedSpecimen.offspringCount} laid across {selectedSpecimen.clutchesLaid || 0} clutches</span></div>
                    <div>Max Lifespan Cap: <span className="text-slate-300">{selectedSpecimen.genome.maxLifespan}s</span></div>
                  </div>
                </div>

                {/* RECENT DEATHS LOG WITH EXACT CAUSES */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-rose-900/40 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-rose-300">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-rose-400" />
                      RECENT DEATHS LOG ({simStateRef.current.recentDeaths?.length || 0})
                    </span>
                    <span className="text-[9px] text-slate-500 font-normal">Cause Attribution Telemetry</span>
                  </div>

                  {(!simStateRef.current.recentDeaths || simStateRef.current.recentDeaths.length === 0) ? (
                    <div className="p-3 text-center text-slate-500 italic">
                      No deaths recorded yet in this simulation run.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {simStateRef.current.recentDeaths.map((death, dIdx) => {
                        const isOldAge = death.cause === 'Old Age';
                        const isPred = death.cause === 'Predation';
                        const badgeStyle = isOldAge
                          ? 'bg-amber-950/80 border-amber-500/50 text-amber-300'
                          : isPred
                          ? 'bg-rose-950/80 border-rose-500/50 text-rose-300'
                          : 'bg-purple-950/80 border-purple-500/50 text-purple-300';
                        return (
                          <div key={dIdx} className="p-2 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-white">{death.name}</span>
                                <span className="text-[9px] text-slate-500">({death.id} · Gen {death.generation})</span>
                              </div>
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                Lived: <strong className="text-slate-200">{death.age.toFixed(1)}s</strong> · Energy at death: <strong className="text-cyan-300">{formatJoules(death.energyAtDeath)}</strong> · Offspring: <strong className="text-emerald-400">{death.offspringCount}</strong>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${badgeStyle}`}>
                                {isOldAge ? '⏳ Old Age' : isPred ? '🥩 Predated' : '⚡ Starved'}
                              </span>
                              <div className="text-[8px] text-slate-500 mt-0.5 font-mono">t={death.timestamp.toFixed(1)}s</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: DIAGNOSTICS */}
            {inspectorActiveTab === 'verification' && (
              <div className="flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto pr-1 text-[10px]">
                <div className="bg-slate-950/80 rounded-xl p-3 border border-cyan-500/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-bold text-xs">DIAGNOSTIC VERIFICATION SUITE</span>
                    <button
                      onClick={runDiagnosticSuite}
                      disabled={diagnosticsRunning}
                      className="px-2 py-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded flex items-center gap-1">
                      <RotateCw size={11} />
                      {diagnosticsRunning ? 'Running…' : 'Re-run'}
                    </button>
                  </div>

                  {(!diagnosticResults.ran || diagnosticsRunning) && <p className="text-cyan-300">{diagnosticsRunning ? 'Running isolated production checks…' : 'Checks have not run.'}</p>}
                  {diagnosticResults.ran && <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>1. Reference Locomotion Benchmark:</span>
                      {diagnosticResults.comLocomotion ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>2. Zero-Drag Momentum Conservation (&mu;=0):</span>
                      {diagnosticResults.zeroDragConservation ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>3. Parent &rarr; Egg &rarr; Hatchling Energy Conservation:</span>
                      {diagnosticResults.eggEnergyAccounting ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>4. True Budget Reproduction (No 60% capacity gate):</span>
                      {diagnosticResults.reproductionAffordability ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>5. Raycast RGB Occlusion & Attenuation:</span>
                      {diagnosticResults.raycastOcclusion ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>6. PRNG Bit Determinism (1000 draws):</span>
                      {diagnosticResults.prngDeterminism ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded border border-slate-800">
                      <span>7. Unfed Lifespan & Old Age Cause Preserved:</span>
                      {diagnosticResults.starvationLifespan ? <span className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 size={13} /> PASS</span> : <span className="text-rose-400 font-bold flex items-center gap-1"><XCircle size={13} /> FAIL</span>}
                    </div>
                  </div>}

                  {diagnosticResults.details.length > 0 && (
                    <div className="p-2 bg-slate-950 rounded border border-slate-800 space-y-1 text-[9px] text-slate-400">
                      <div className="text-cyan-400 font-bold">Execution Telemetry Log:</div>
                      {diagnosticResults.details.map((d, i) => (
                        <div key={i}>• {d}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DRAGGABLE ECOSYSTEM TELEMETRY LEDGER */}
        {isEcosystemGraphOpen && (
          <div ref={ledgerDraggable.panelRef} data-testid="ledger-window"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: `translate3d(${ledgerDraggable.pos.x}px, ${ledgerDraggable.pos.y}px, 0)`,
              pointerEvents: 'auto',
            }}
            className="vida-window absolute top-0 left-0 bg-slate-900/95 backdrop-blur-lg border border-emerald-500/50 rounded-2xl p-4 w-[352px] flex flex-col font-mono text-xs shadow-2xl z-40 pointer-events-auto">
            <div
              {...ledgerDraggable.headerProps}
              className="flex items-center justify-between border-b border-emerald-500/30 pb-2 mb-3 shrink-0 touch-none cursor-grab active:cursor-grabbing select-none">
              <div className="flex items-center gap-2">
                <GripHorizontal className="text-emerald-400" size={16} />
                <Activity className="text-emerald-400" size={16} />
                <span className="font-bold text-emerald-300 text-sm">THERMODYNAMIC BUDGET LEDGER</span>
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setIsEcosystemGraphOpen(false);
                  gameAudio.playCrispClick();
                }}
                title="Close ledger (✕)"
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="w-full h-16 bg-slate-950 rounded-xl p-2 border border-slate-800 flex items-end gap-1 mb-3">
              {popHistoryRef.current.map((count, idx) => {
                const max = Math.max(30, ...popHistoryRef.current);
                const heightPercent = Math.min(100, Math.max(8, (count / max) * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-emerald-600 to-cyan-400 rounded-t"
                    style={{height: `${heightPercent}%`}}
                    title={`Population: ${count}`}
                  />
                );
              })}
            </div>

            <div className="space-y-1.5 text-[10px] text-slate-300">
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>External Energy Added:</span>
                <span className="text-emerald-400 font-bold">{formatJoules(ecoStats.totalExternalInflow)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Stored Biomass:</span>
                <span className="text-purple-300 font-bold">{formatJoules(ecoStats.totalStoredBiomass)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Stored Reserves:</span>
                <span className="text-cyan-300 font-bold">{formatJoules(ecoStats.totalStoredReserves)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Stored Egg Energy:</span>
                <span className="text-amber-300 font-bold">{formatJoules(ecoStats.totalEggEnergy)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Free Food (Plants + Remains):</span>
                <span className="text-emerald-300 font-bold">{formatJoules(ecoStats.totalFoodEnergy)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Metabolic Heat Dissipation:</span>
                <span className="text-rose-400 font-bold">{formatJoules(ecoStats.totalMetabolicHeat)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Mechanical Work Heat:</span>
                <span className="text-orange-400 font-bold">{formatJoules(ecoStats.totalMechanicalHeat)}</span>
              </div>
              <div className="flex justify-between bg-slate-950/60 p-1.5 rounded border border-slate-800">
                <span>Recorded Losses & Rejections:</span>
                <span className="text-slate-400 font-bold">{formatJoules(ecoStats.totalRecordedLosses)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM ACTION TOOLBAR */}
      <footer data-testid="action-toolbar" className="w-full bg-slate-900/95 border-t border-cyan-500/20 backdrop-blur-md px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setGameState((prev) => ({
                ...prev,
                status: prev.status === 'PLAYING' ? 'PAUSED' : 'PLAYING',
              }));
              gameAudio.playCrispClick();
            }}
            className="min-w-[44px] min-h-[44px] px-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-md text-xs md:text-sm">
            {gameState.status === 'PLAYING' ? <Pause size={16} /> : <Play size={16} />}
            <span>{gameState.status === 'PLAYING' ? 'Pause' : 'Resume'}</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              cameraRef.current.targetX = worldWidth / 2;
              cameraRef.current.targetY = worldHeight / 2;
              cameraRef.current.zoom = 0.85;
              setIsAutoTracking(false);
              gameAudio.playCrispClick();
            }}
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono text-xs flex items-center justify-center gap-1.5">
            <Compass size={15} />
            <span className="hidden sm:inline">Center Cam</span>
          </button>
        </div>

        {/* Feeding Buttons */}
        <div className="flex items-center gap-2 mr-auto">
          <button
            onClick={(e) => { e.stopPropagation(); spawnNutrientBurst(); }}
            className="min-w-[44px] min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-md text-xs md:text-sm">
            <Plus size={16} />
            <span>Feed (F)</span>
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); feedAllOrganisms(); }}
            className="min-w-[44px] min-h-[44px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 font-mono text-xs font-bold flex items-center justify-center gap-1.5 transition-transform active:scale-95 shadow-md">
            <Sparkles size={15} />
            <span>Feed All</span>
          </button>
        </div>
        <span data-testid="build-version" className="ml-auto shrink-0 text-[10px] font-mono text-slate-400" title="Current VIDA version">v{BUILD_VERSION}</span>
      </footer>

      {/* --- OVERLAYS --- */}
      {gameState.status === 'START' && (
        <MenuOverlay tone="neutral" zIndex={50}>
          <div className="w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto shrink-0 bg-slate-900/95 border-2 border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center backdrop-blur-xl text-center m-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center mb-4 shadow-inner">
              <img
                src={neuralNodeIconUrl}
                alt="Neural Node"
                className="w-12 h-12 object-contain"
              />
            </div>
            <h1 className="text-3xl md:text-5xl font-black mb-2 text-cyan-300 font-mono tracking-wider">
              VIDA
            </h1>
            <p className="text-[10px] text-slate-400 mb-2">{CREDITS}</p>
            <p className="text-cyan-400/80 font-mono text-xs tracking-widest uppercase mb-4">
              Recurrent Neural Brains & Hydrodynamic Artificial Life
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Observe swimming creatures driven by inherited recurrent neural networks, genuine fluid hydrodynamics, and closed-loop thermodynamics!
            </p>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => initGame('standard')}
                autoFocus
                className="w-full bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-lg shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2">
                <Play size={22} />
                SEED SIMULATION
              </button>

              <AudioControls sfxVolume={sfxVolume} musicVolume={musicVolume}
                sfxMuted={sfxMuted} musicMuted={musicMuted}
                onSfxVolume={setSfxVolume} onMusicVolume={setMusicVolume}
                onSfxMute={() => setSfxMuted(gameAudio.toggleMute())}
                onMusicMute={() => setMusicMuted(prev => !prev)}
                musicTrack={musicTrack} onMusicTrack={setMusicTrack} />

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => initGame('predator_cove')}
                  className="bg-slate-800/80 hover:bg-slate-750 text-rose-300 border border-rose-500/30 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
                  <Flame size={16} />
                  Predator Cove
                </button>
                <button
                  onClick={() => initGame('megafauna')}
                  className="bg-slate-800/80 hover:bg-slate-750 text-purple-300 border border-purple-500/30 px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors">
                  <Zap size={16} />
                  Megafauna
                </button>
              </div>
            </div>
          </div>
        </MenuOverlay>
      )}

      {gameState.status === 'GAME_OVER' && (
        <Overlay
          title="TOTAL EXTINCTION"
          description={`The Vida ecosystem went cold after reaching Generation ${ecoStats.maxGeneration}. All specimens and eggs have dissolved.`}
          actionLabel="RESEED ECOSYSTEM"
          onAction={() => initGame('standard')}
          icon={<RotateCw size={24} />}
          tone="danger"
        />
      )}

      {gameState.status === 'PAUSED' && !isGameMenuOpen && (
        <Overlay
          title="SIMULATION PAUSED"
          description="Ecosystem paused. Press space or resume to continue observing."
          actionLabel="RESUME SIMULATION"
          onAction={() => setGameState((prev) => ({...prev, status: 'PLAYING'}))}
          icon={<Play size={24} />}
          tone="neutral"
        />
      )}

      {/* GAME MENU */}
      {isGameMenuOpen && (
        <MenuOverlay tone="neutral" zIndex={60}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto shrink-0 bg-slate-900 border-2 border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center backdrop-blur-xl m-4">
            <h2 className="text-2xl md:text-3xl font-black mb-6 text-cyan-300 font-mono tracking-wider">
              SIMULATION MENU
            </h2>
            <p className="text-[10px] text-slate-400 mb-3">{CREDITS}</p>

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); setIsGameMenuOpen(false); }}
                autoFocus
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-6 py-3 rounded-xl font-bold text-base transition-colors flex items-center justify-center gap-2">
                <Play size={18} />
                RESUME
              </button>

              <AudioControls sfxVolume={sfxVolume} musicVolume={musicVolume}
                sfxMuted={sfxMuted} musicMuted={musicMuted}
                onSfxVolume={setSfxVolume} onMusicVolume={setMusicVolume}
                onSfxMute={() => setSfxMuted(gameAudio.toggleMute())}
                onMusicMute={() => setMusicMuted(prev => !prev)}
                musicTrack={musicTrack} onMusicTrack={setMusicTrack} />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGameMenuOpen(false);
                  initGame('standard');
                }}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2">
                <RotateCw size={16} />
                RESEED SOUP
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsHowToPlayOpen(true);
                }}
                className="w-full bg-slate-800 hover:bg-slate-750 text-cyan-300 px-4 py-2.5 rounded-xl font-bold text-sm border border-slate-700 transition-colors flex items-center justify-center gap-2">
                <Info size={16} />
                RESEARCH & CONTROLS GUIDE
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsGameMenuOpen(false);
                  setGameState((prev) => ({...prev, status: 'START'}));
                }}
                className="w-full bg-red-950/50 hover:bg-red-900/60 text-red-300 px-4 py-2.5 rounded-xl font-bold text-sm border border-red-800/40 transition-colors">
                MAIN MENU
              </button>
            </div>
          </div>
        </MenuOverlay>
      )}

      {/* HOW TO PLAY */}
      {isHowToPlayOpen && (
        <MenuOverlay tone="neutral" zIndex={70}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-slate-900 border-2 border-cyan-500/40 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col backdrop-blur-xl m-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-cyan-500/30 pb-3 mb-4">
              <h3 className="text-xl font-bold text-cyan-300 font-mono">
                VIDA: RESEARCH & CONTROLS GUIDE
              </h3>
              <button
                onClick={(e) => { e.stopPropagation(); setIsHowToPlayOpen(false); }}
                className="text-slate-400 hover:text-white p-1">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-sans leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-cyan-500/30">
                <h4 className="font-bold text-cyan-400 mb-1">1. Recurrent Neural Networks (RNN)</h4>
                <p>
                  Eyes see creatures, food and white eggs fading into black with distance; walls and visual effects are invisible. Each organism has an inherited recurrent neural controller (24 hidden neurons in original founders, with support for other bounded sizes). Its tanh recurrence provides short-term state for steering and rhythmic control; reliable goal-directed foraging is not yet established.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/30">
                <h4 className="font-bold text-amber-400 mb-1">2. 6-Channel Motor Actuation</h4>
                <p>
                  Every joint has six neural controls: angle bias, frequency, torque limit, stiffness, stroke amplitude, and motor engagement. Disengaged motors apply no active torque; water resistance slows coasting. Oral sensors report edible contact and absorbed intake from the previous tick.
                </p>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-purple-500/30">
                <h4 className="font-bold text-purple-400 mb-1">3. Closed-Loop Biological Energy Accounting</h4>
                <p>
                  All mouths absorb 80% of ingested energy; the loss becomes heat. Carrion retains its additional digestion loss. Eggs conserve energy upon laying and hatching. Predated eggs cannot hatch into free bodies and instead leave edible remains that later decompose into nutrients, strictly enforcing zero free structural tissue creation.
                </p>
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setIsHowToPlayOpen(false); }}
              className="mt-5 w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold py-2.5 rounded-xl transition-colors">
              BACK TO SIMULATION
            </button>
          </div>
        </MenuOverlay>
      )}
    </div>
  );
}
