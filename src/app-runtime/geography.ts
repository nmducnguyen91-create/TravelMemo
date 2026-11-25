import type { Geography } from '../core/application/visit-service';
import type { GeoDataset } from '../engines/atlas-engine/dataset';
import vietnam from '../../assets/geography/vietnam.json';
import world from '../../assets/geography/world.json';

export const geography: Geography = {
  world: world as unknown as GeoDataset,
  vietnam: vietnam as unknown as GeoDataset,
};

export function countryName(code: string | null | undefined): string {
  if (!code) return '';
  return geography.world.regions.find((r) => r.code === code)?.nameVi ?? code;
}

export function provinceName(code: string | null | undefined): string {
  if (!code) return '';
  return geography.vietnam.regions.find((r) => r.code === code)?.nameVi ?? code;
}

export const countriesSorted = [...geography.world.regions].sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));
export const provincesSorted = [...geography.vietnam.regions].sort((a, b) => a.nameVi.localeCompare(b.nameVi, 'vi'));
