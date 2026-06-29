const GRADIENTS = [
  'bg-gradient-to-tr from-orange-500 to-red-600',
  'bg-gradient-to-tr from-blue-600 to-purple-700',
  'bg-gradient-to-tr from-emerald-500 to-teal-700',
  'bg-gradient-to-tr from-fuchsia-500 to-pink-600',
  'bg-gradient-to-tr from-amber-500 to-orange-600',
  'bg-gradient-to-tr from-indigo-500 to-violet-700',
  'bg-gradient-to-tr from-cyan-500 to-blue-600',
  'bg-gradient-to-tr from-rose-500 to-red-700',
];

export function gradientForGameName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % GRADIENTS.length;
  }
  return GRADIENTS[hash] ?? GRADIENTS[0];
}

export function formatPlaytime(totalPlayMs: number): string {
  if (totalPlayMs <= 0) return '0m';
  const totalMinutes = Math.floor(totalPlayMs / 60000);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
