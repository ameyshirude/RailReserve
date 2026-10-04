export function readBookingDraft(key) {
  try {
    const draft = JSON.parse(sessionStorage.getItem(key));
    if (draft?.version !== 1 || ![2, 3].includes(draft.step) || !draft.selectedCoach ||
        !draft.reservation || !Array.isArray(draft.passengers) ||
        (draft.step === 3 && (!draft.booking || !draft.clientSecret))) return {};
    return draft;
  } catch {
    return {};
  }
}

export function saveBookingDraft(key, draft) {
  try {
    if (draft.step === 4) sessionStorage.removeItem(key);
    else if (draft.step === 2 || draft.step === 3) sessionStorage.setItem(key, JSON.stringify({ ...draft, version: 1 }));
  } catch {
    // Booking remains usable when browser storage is unavailable.
  }
}

export function reservationSecondsLeft(expiresAt) {
  const remaining = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Number.isFinite(remaining) ? Math.max(0, remaining) : 0;
}
