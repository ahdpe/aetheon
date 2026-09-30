import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  
  // AI Observer
  VENICE_API_KEY: process.env.VENICE_API_KEY || '',
  VENICE_API_URL: process.env.VENICE_API_URL || 'https://api.venice.ai/api/v1/chat/completions',
  VENICE_MODEL: process.env.VENICE_MODEL || 'llama-3.3-70b',
  AI_OBSERVER_INTERVAL_MS: (parseInt(process.env.AI_OBSERVER_INTERVAL_MIN || '25', 10)) * 60 * 1000,
  
  // Simulation Constants
  TICK_RATE_HZ: parseInt(process.env.TICK_RATE_HZ || '10', 10),
  TICK_INTERVAL_MS: 1000 / parseInt(process.env.TICK_RATE_HZ || '10', 10),
  GRID_SIZE: parseInt(process.env.GRID_SIZE || '128', 10), // 128x128 chemical grid
  WORLD_SIZE: 1000.0, // Continuous virtual coordinates [0, WORLD_SIZE)
  
  MAX_ORGANISMS: parseInt(process.env.MAX_ORGANISMS || '1000', 10),
  MIN_ORGANISMS: 180, // Spontaneous biogenesis triggers if population drops below this
  
  // Persistence
  PERSIST_INTERVAL_MS: (parseInt(process.env.PERSIST_INTERVAL_MIN || '10', 10)) * 60 * 1000,
  SNAPSHOT_FILE: path.resolve(__dirname, '..', process.env.SNAPSHOT_FILE || 'data/aetheon_world.json'),
  
  // Thermodynamic & Chemical Rates
  DIFFUSION_RATE_NUTRIENT: 0.08,
  DIFFUSION_RATE_WASTE: 0.04,
  DIFFUSION_RATE_SIGNAL: 0.12,
  DECAY_RATE_NUTRIENT: 0.0005,
  DECAY_RATE_WASTE: 0.003,
  DECAY_RATE_SIGNAL: 0.02,
  
  VENT_COUNT: 5, // Hydrothermal mineral vents generating steady food
  VENT_POWER: 0.45,
  
  // Energy dissipation & metabolism
  BASE_METABOLIC_RATE: 0.08,
  DIVISION_ENERGY_THRESHOLD: 120.0,
  INITIAL_ORGANISM_ENERGY: 60.0,
  MAX_ORGANISM_ENERGY: 250.0
};
