export function uniqueCoachFareOptions(coaches = []) {
  const byType = new Map();

  for (const coach of coaches) {
    const type = String(coach?.type || coach?.name || "").trim().toUpperCase();
    if (type && !byType.has(type)) {
      byType.set(type, { ...coach, type });
    }
  }

  return Array.from(byType.values());
}
