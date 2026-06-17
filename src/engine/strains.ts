import { strainColor } from '../colors';

export interface StrainInfo {
  id: number;
  color: [number, number, number];
}

export function paletteColor(index: number): [number, number, number] {
  return strainColor(index + 1);
}

export class StrainRegistry {
  active: StrainInfo | null = null;
  private strains: StrainInfo[] = [];

  create(): StrainInfo {
    const id = this.strains.length + 1;
    const info: StrainInfo = { id, color: paletteColor(this.strains.length) };
    this.strains.push(info);
    this.active = info;
    return info;
  }

  get(id: number): StrainInfo | undefined {
    return this.strains.find((s) => s.id === id);
  }

  setActive(id: number): void {
    const found = this.get(id);
    if (found) this.active = found;
  }

  all(): StrainInfo[] {
    return [...this.strains];
  }
}
