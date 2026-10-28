export const SIMULATION_SPEEDS = [0, 1, 2, 5, 10, 20, 'max'] as const;
export type SimulationSpeed = typeof SIMULATION_SPEEDS[number];
export interface PlaybackSpeed {
  speed: SimulationSpeed;
  lastNonzero: Exclude<SimulationSpeed, 0>;
}

export function isSimulationSpeed(value: unknown): value is SimulationSpeed {
  return SIMULATION_SPEEDS.includes(value as SimulationSpeed);
}

export function selectSimulationSpeed(previous: PlaybackSpeed, speed: SimulationSpeed): PlaybackSpeed {
  return {speed, lastNonzero: speed === 0 ? previous.lastNonzero : speed};
}

export function toggleSimulationSpeed(previous: PlaybackSpeed): PlaybackSpeed {
  return selectSimulationSpeed(previous, previous.speed === 0 ? previous.lastNonzero : 0);
}
