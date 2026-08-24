import { uiAccess } from './accessMapLoader';
export function resolveContract(id: string) {
  return uiAccess.contract(id);
}
