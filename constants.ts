import {SpriteConfig} from './utils/helper';
import exportedConfig from './playground_config.json';

/**
 * Configuration for the Vida game.
 */
export const CONFIG = {
  title: {
    value: 'Vida',
    type: 'string',
    label: 'Game Title',
    group: 'GAME',
  },
  baseCanvasWidth: {
    value: 1280,
    type: 'number',
    label: 'Base Canvas Width',
    group: 'GAME',
  },
  baseCanvasHeight: {
    value: 720,
    type: 'number',
    label: 'Base Canvas Height',
    group: 'GAME',
  },

  // System Constants for the physics loop
  targetFPS: {
    value: 60,
    type: 'number',
    label: 'Target FPS',
    group: 'SYSTEM',
  },
  stepMs: {
    value: 1000 / 60,
    type: 'number',
    label: 'Step MS',
    group: 'SYSTEM',
  },
  maxSubSteps: {
    value: 5,
    type: 'number',
    label: 'Max Sub Steps',
    group: 'SYSTEM',
  },
  physicsSubstepsPerFrame: {
    value: 4,
    type: 'number',
    label: 'Physics Substeps Per Frame (1/240s)',
    group: 'SYSTEM',
  },

  // Thematic elements
  backgroundColor: {
    value: '#030814',
    type: 'color',
    label: 'Background Color',
    group: 'THEME',
  },
  primaryColor: {
    value: '#06b6d4',
    type: 'color',
    label: 'Primary Color',
    group: 'THEME',
  },
  fontFamily: {
    value: 'Inter, system-ui, sans-serif',
    type: 'string',
    label: 'Font Family',
    group: 'THEME',
  },

  // Audio Levels
  defaultMusicVolume: {
    value: 0.5,
    type: 'number',
    label: 'Default Music Volume',
    group: 'AUDIO',
  },
  defaultSfxVolume: {
    value: 0.6,
    type: 'number',
    label: 'Default SFX Volume',
    group: 'AUDIO',
  },

  // World & Tank dimensions (compact area: 2400x1500)
  worldWidth: {
    value: 2400,
    type: 'number',
    label: 'World Tank Width',
    group: 'World',
  },
  worldHeight: {
    value: 1500,
    type: 'number',
    label: 'World Tank Height',
    group: 'World',
  },
  // Energy & Physics Calibration
  forceCostMultiplier: {
    value: 0.000000175,
    type: 'number',
    label: 'Force Cost Multiplier',
    group: 'Physics',
  },
  basalMetabolicRate: {
    value: 12.0,
    type: 'number',
    label: 'Basal Metabolic Rate (J/s)',
    group: 'Physics',
  },
  baseFounderArea: {
    value: 36.0,
    type: 'number',
    label: 'Base Founder Area',
    group: 'Physics',
  },
  waterViscosity: {
    value: 0.22,
    type: 'number',
    label: 'Water Viscosity (μ)',
    group: 'Physics',
  },
  tangentialDragFactor: {
    value: 0.0,
    type: 'number',
    label: 'Tangential Drag',
    group: 'Physics',
  },

  // Population & Ecosystem rules
  initialOrganisms: {
    value: 18,
    type: 'number',
    label: 'Initial Population',
    group: 'Rules',
  },
  maxOrganisms: {
    value: 30,
    type: 'number',
    label: 'Max Population',
    group: 'Rules',
  },
  targetNutrientCount: {
    value: 275,
    type: 'number',
    label: 'Nutrient Abundance Target',
    group: 'Rules',
  },
  nutrientInflowRate: {
    value: 15,
    type: 'number',
    label: 'Nutrient Inflow (items/s)',
    group: 'Rules',
  },
  reproductionEnergy: {
    value: 0.60,
    type: 'number',
    label: 'Reproduction Threshold',
    group: 'Rules',
  },
  mutationRate: {
    value: 0.25,
    type: 'number',
    label: 'Mutation Severity',
    group: 'Rules',
  },
  founderStartingReserve: {
    value: 10000,
    type: 'number',
    label: 'Founder Starting Reserve (J)',
    group: 'Rules',
  },
  founderMaxCapacity: {
    value: 100000,
    type: 'number',
    label: 'Founder Max Capacity (J)',
    group: 'Rules',
  },
  nutrientEnergyValue: {
    value: 3000,
    type: 'number',
    label: 'Nutrient Energy Value (J)',
    group: 'Rules',
  },

  // Asset Dimensions & Aspect Ratios (from read_assets_metadata)
  assetNeuralNodeAspectRatio: {
    value: 1.0, // 770 / 770
    type: 'number',
    label: 'Neural Node Aspect Ratio',
    group: 'ASSETS',
  },
  assetNeuralNodeWidth: {
    value: 770,
    type: 'number',
    label: 'Neural Node Width',
    group: 'ASSETS',
  },
  assetNeuralNodeHeight: {
    value: 770,
    type: 'number',
    label: 'Neural Node Height',
    group: 'ASSETS',
  },

  assetOrganismEggAspectRatio: {
    value: 0.7852, // 468 / 596
    type: 'number',
    label: 'Organism Egg Aspect Ratio',
    group: 'ASSETS',
  },
  assetOrganismEggWidth: {
    value: 468,
    type: 'number',
    label: 'Organism Egg Width',
    group: 'ASSETS',
  },
  assetOrganismEggHeight: {
    value: 596,
    type: 'number',
    label: 'Organism Egg Height',
    group: 'ASSETS',
  },

  assetNutrientParticleAspectRatio: {
    value: 1.0029, // 688 / 686
    type: 'number',
    label: 'Nutrient Particle Aspect Ratio',
    group: 'ASSETS',
  },
  assetNutrientParticleWidth: {
    value: 688,
    type: 'number',
    label: 'Nutrient Particle Width',
    group: 'ASSETS',
  },
  assetNutrientParticleHeight: {
    value: 686,
    type: 'number',
    label: 'Nutrient Particle Height',
    group: 'ASSETS',
  },

  assetDnaHelixAspectRatio: {
    value: 0.4584, // 270 / 589
    type: 'number',
    label: 'DNA Helix Aspect Ratio',
    group: 'ASSETS',
  },
  assetDnaHelixWidth: {
    value: 270,
    type: 'number',
    label: 'DNA Helix Width',
    group: 'ASSETS',
  },
  assetDnaHelixHeight: {
    value: 589,
    type: 'number',
    label: 'DNA Helix Height',
    group: 'ASSETS',
  },
};

// Merge customized config values if present (injected by Playground)
const {playgroundConfig} = globalThis as {
  playgroundConfig?: Record<string, unknown>;
};
{
  for (const [key, value] of Object.entries({...exportedConfig.values, ...playgroundConfig})) {
    if (key in CONFIG) {
      Object.assign(CONFIG[key as keyof typeof CONFIG], {value});
    }
  }
}

/**
 * Type helper for reading values in game code
 */
export type ConfigKey = keyof typeof CONFIG;

/**
 * Gets a configuration value by key.
 * @param key The configuration key.
 * @return The configuration value.
 */
export function getConfig<K extends ConfigKey>(
  key: K,
): (typeof CONFIG)[K]['value'] {
  return CONFIG[key].value;
}

export const THEME = {
  primary: '#06b6d4',
  accent: '#10b981',
  coral: '#f43f5e',
  amber: '#f59e0b',
  purple: '#8b5cf6',
  abyssDark: '#030814',
  deepWater: '#07162c',
  panelBg: 'rgba(7, 22, 44, 0.85)',
  panelBorder: 'rgba(6, 182, 212, 0.3)',
};
