export const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export function runningDays(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(value);
    if (Array.isArray(parsed)) {
      const days = [...new Set(parsed.map(Number))]
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort((a, b) => a - b);
      if (days.length) return days;
    }
  } catch { /* Older records without a schedule run daily. */ }
  return ALL_DAYS;
}

export function formatRunningDays(value) {
  const days = runningDays(value);
  return days.length === 7 ? "Daily" : days.map((day) => WEEK_DAYS[day].slice(0, 3)).join(", ");
}

export function filterAdminTrains(trains, { query, day, coachClass, bookings }) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return trains.filter((train) => {
    const searchable = [train.name, train.number, ...(train.halts || []).map((halt) => halt.stationName)]
      .join(" ").toLowerCase();
    const days = runningDays(train.runningDays);
    const bookingCount = train._count?.bookings || 0;
    return terms.every((term) => searchable.includes(term)) &&
      (!day || (day === "daily" ? days.length === 7 : days.includes(Number(day)))) &&
      (!coachClass || (train.coaches || []).some((coach) => coach.type === coachClass)) &&
      (!bookings || (bookings === "with" ? bookingCount > 0 : bookingCount === 0));
  });
}
