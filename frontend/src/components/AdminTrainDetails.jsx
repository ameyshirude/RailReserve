import React from "react";

export function TrainRouteDetails({ train }) {
  const halts = [...(train.halts || [])].sort((a, b) => a.order - b.order);
  if (!halts.length) return <span className="text-muted">No route configured</span>;

  return (
    <div className="admin-route">
      <p className="admin-route__summary">
        {halts[0].stationName} <span aria-hidden="true">→</span>
        <span className="visually-hidden"> to </span> {halts[halts.length - 1].stationName}
      </p>
      <details className="admin-details">
        <summary aria-label={`View ${halts.length} halts for ${train.name}`}>
          {halts.length} halts · Route details
        </summary>
        <ol className="admin-route__halts">
          {halts.map((halt, index) => (
            <li key={halt.id ?? index}>
              <strong>{halt.stationName}</strong>
              <div className="admin-route__times">
                {halt.arrivalTime && <span>Arr {halt.arrivalTime} · Day {halt.arrivalDay || 1}</span>}
                {halt.departureTime && <span>Dep {halt.departureTime} · Day {halt.departureDay || 1}</span>}
                {!halt.arrivalTime && !halt.departureTime && <span>Time not set</span>}
                {halt.distance != null && <span>{Number(halt.distance).toLocaleString("en-IN")} km from origin</span>}
              </div>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

export function TrainCoachDetails({ train }) {
  const coaches = train.coaches || [];
  const classes = [...new Set(coaches.map((coach) => coach.type))];
  if (!coaches.length) return <span className="text-muted">No coaches</span>;
  return (
    <div>
      <div className="admin-trains__badges" aria-label="Coach classes">
        {classes.map((type) => <span key={type}>{type}</span>)}
      </div>
      <details className="admin-details">
        <summary aria-label={`View coaches for ${train.name}`}>{coaches.length} coach{coaches.length === 1 ? "" : "es"}</summary>
        <ul className="admin-coach-list">
          {coaches.map((coach) => <li key={coach.id || coach.name}><strong>{coach.name} · {coach.type}</strong><span>{coach.totalSeats} seats</span></li>)}
        </ul>
      </details>
    </div>
  );
}
