let activePublicConfigVersion = 1;

export function setActivePublicConfigVersion(version: number): void {
  if (Number.isFinite(version) && version > 0) activePublicConfigVersion = version;
}

export function getActivePublicConfigVersion(): number {
  return activePublicConfigVersion;
}
