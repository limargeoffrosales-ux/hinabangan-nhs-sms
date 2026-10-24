// Class name utility
// Merges class names and filters falsy values

export type ClassValue = string | number | null | undefined | boolean | ClassValue[] | { [key: string]: boolean | undefined | null };

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const processValue = (value: ClassValue): void => {
    if (!value) return;
    if (typeof value === 'string' || typeof value === 'number') {
      classes.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(processValue);
      return;
    }
    if (typeof value === 'object') {
      Object.entries(value).forEach(([key, val]) => {
        if (val) classes.push(key);
      });
    }
  };

  inputs.forEach(processValue);
  return classes.join(' ');
}

export default cn;