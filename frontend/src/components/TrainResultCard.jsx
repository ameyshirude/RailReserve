import React from "react";
import { uniqueCoachFareOptions } from "../utils/coachDisplay";
import { formatJourneyDate } from "../utils/bookingRoute";
import { minimumTrainFare } from "../utils/trainSearch";

export default function TrainResultCard({ train, onSelect, needsLogin }) {
  const minFare = minimumTrainFare(train);
  const classes = uniqueCoachFareOptions(train.coaches);
  const titleId = `train-${train.id}-title`;

  return (
    <article className="train-result" aria-labelledby={titleId}>
      <header className="train-result__header">
        <h3 id={titleId}>{train.name}</h3>
        <span className="train-result__number">#{train.number}</span>
      </header>
      <div className="train-result__grid">
        <div className="train-result__stop">
          <span className="train-result__label">Departs</span>
          <strong className="train-result__time">{train.boardingHalt?.departureTime || "—"}</strong>
          <span>{train.boardingHalt?.stationName}</span>
          <span className="train-result__date">{formatJourneyDate(train.boardingDate)}</span>
        </div>
        <div className="train-result__duration">
          <span className="train-result__label">Duration</span>
          <strong>{train.durationText || "—"}</strong>
          <span className="train-result__line" aria-hidden="true">→</span>
        </div>
        <div className="train-result__stop">
          <span className="train-result__label">Arrives</span>
          <strong className="train-result__time">{train.destinationHalt?.arrivalTime || "—"}</strong>
          <span>{train.destinationHalt?.stationName}</span>
          <span className="train-result__date">{formatJourneyDate(train.destinationDate)}</span>
        </div>
        <div className="train-result__action">
          <span className="train-result__label">From / passenger</span>
          <strong className="train-result__fare">{minFare === null ? "Unavailable" : `₹${minFare.toLocaleString("en-IN")}`}</strong>
          <button type="button" className="btn btn-primary" onClick={() => onSelect(train)} aria-label={`Select train ${train.name}, number ${train.number}`}>
            Select train <span aria-hidden="true">→</span>
          </button>
          {needsLogin && <span className="train-result__date">Sign in at the next step</span>}
        </div>
      </div>
      {classes.length > 0 && (
        <ul className="train-result__classes" aria-label="Classes and fares per passenger">
          {classes.map((coach) => (
            <li key={coach.type}><strong>{coach.type}</strong><span>₹{Number(coach.routeFare || 0).toLocaleString("en-IN")}</span></li>
          ))}
        </ul>
      )}
    </article>
  );
}
