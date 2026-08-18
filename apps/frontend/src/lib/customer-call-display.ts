export type DisplayColor = 'gray' | 'yellow' | 'blue' | 'red' | 'green' | 'orange';

export function displayColorClass(color: DisplayColor | string): string {
  switch (color) {
    case 'yellow':
      return 'border-amber-400 bg-amber-500/10';
    case 'blue':
      return 'border-sky-400 bg-sky-500/10';
    case 'red':
      return 'border-red-400 bg-red-500/10';
    case 'green':
      return 'border-emerald-400 bg-emerald-500/10';
    case 'orange':
      return 'border-orange-400 bg-orange-500/10';
    default:
      return 'border-slate-800 bg-transparent';
  }
}

export function displayBadgeEmoji(color: DisplayColor | string): string {
  switch (color) {
    case 'yellow':
      return '🟡';
    case 'blue':
      return '🔵';
    case 'red':
      return '🔴';
    case 'green':
      return '🟢';
    case 'orange':
      return '🟠';
    default:
      return '⚪';
  }
}
