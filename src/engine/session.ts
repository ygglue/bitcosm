import type { WorldState, Genome } from '../sim/types';
import type { Camera } from './camera';
import type { StrainInfo } from './strains';
import { serializeWorld, deserializeWorld, SCHEMA_VERSION, type SaveData } from './persistence';

export function captureSession(
  world: WorldState,
  camera: Camera,
  strains: StrainInfo[],
  genome: Genome,
): SaveData {
  return {
    schemaVersion: SCHEMA_VERSION,
    world: serializeWorld(world),
    camera,
    strains,
    activeGenome: genome,
  };
}

export interface RestoredSession {
  world: WorldState;
  camera: Camera;
  strains: StrainInfo[];
  genome: Genome;
}

export function restoreSession(data: SaveData): RestoredSession {
  return {
    world: deserializeWorld(data.world),
    camera: data.camera,
    strains: data.strains,
    genome: data.activeGenome,
  };
}
