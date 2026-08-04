import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import BookingFlowModal from "../components/BookingFlowModal";
import StationAutocomplete from "../components/StationAutocomplete";
import { uniqueCoachFareOptions } from "../utils/coachDisplay";
import "./Home.css";

const todayInputValue = () => new Date().toISOString().slice(0, 10);

function formatHaltDateTime(halt, timeField, date) {
  const time = halt?.[timeField];
  if (!time) return "—";
  if (!date) return time;
  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
  return `${formattedDate}, ${time}`;
}

export default function Home() {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const location      = useLocation();

  const [boarding,      setBoarding]     = useState("");
  const [destination,   setDestination]  = useState("");
  const [trains,        setTrains]       = useState([]);
  const [searched,      setSearched]     = useState(false);
  const [searching,     setSearching]    = useState(false);
  const [searchError,   setSearchError]  = useState("");
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [travelDate,    setTravelDate]    = useState(todayInputValue());
  const [stations,      setStations]      = useState([]);

  // Fetch all station names on mount
  useEffect(() => {
    let cancelled = false;
    async function loadStations() {
      try {
        const { data } = await apiClient.get("/stations");
        if (!cancelled) setStations(data.stations);
      } catch (err) {
        console.error("Failed to load stations:", err);
      }
    }
    loadStations();
    return () => { cancelled = true; };
  }, []);

  // Clear destination when boarding changes
  const handleBoardingChange = (value) => {
    setBoarding(value);
    if (destination && value && destination.toLowerCase() === value.toLowerCase()) {
      setDestination("");
    }
  };

  useEffect(() => {
    const pending = location.state?.pendingTrain;
    if (!pending || !user) return;

    let cancelled = false;
    const nextTravelDate = pending.travelDate || todayInputValue();

    async function restorePendingBooking() {
      setBoarding(pending.boarding);
      setDestination(pending.destination);
      setTravelDate(nextTravelDate);
      setSearchError("");
      setSearching(true);

      try {
        const { data } = await apiClient.get("/trains/search", {
          params: {
            boarding: pending.boarding,
            destination: pending.destination,
            date: nextTravelDate,
          },
        });
        if (cancelled) return;

        const restoredTrain =
          data.trains.find((train) => train.id === pending.train?.id) || data.trains[0] || null;

        setTrains(data.trains);
        setSearched(true);
        setSelectedTrain(restoredTrain);
      } catch (err) {
        if (!cancelled) {
          setTrains([]);
          setSearched(true);
          setSearchError(
            err.response?.data?.message || "Search failed. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
          navigate(".", { replace: true, state: null });
        }
      }
    }

    restorePendingBooking();

    return () => {
      cancelled = true;
    };
  }, [location.state, navigate, user]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!boarding.trim() || !destination.trim()) return;
    setSearchError("");
    setSearched(false);
    setTrains([]);
    setSearching(true);
    try {
      const { data } = await apiClient.get("/trains/search", {
        params: {
          boarding: boarding.trim(),
          destination: destination.trim(),
          date: travelDate,
        },
      });
      setTrains(data.trains);
      setSearched(true);
    } catch (err) {
      setSearchError(err.response?.data?.message || "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleTrainClick = (train) => {
    if (user) {
      setSelectedTrain(train);
    } else {
      sessionStorage.setItem(
        "pendingBooking",
        JSON.stringify({ train, boarding, destination, travelDate })
      );
      navigate("/login");
    }
  };

  return (
    <div className="home-page">
      <div className="container py-5">

        {/* Search card */}
        <div className="ticket-card mb-4">
          <div className="ticket-card__header">
            <h1 className="font-display mb-0" style={{ fontSize: "1.6rem" }}>
              🚆 Find Your Train
            </h1>
            <p style={{ fontFamily: "var(--font-body)", textTransform: "none", letterSpacing: "normal", color: "white", fontSize: "0.92rem", margin: "0.25rem 0 0" }}>
              Search with boarding and destination station.
            </p>
          </div>
          <div className="ticket-perforation" />
          <div className="ticket-card__body">
            <form onSubmit={handleSearch} noValidate>
              <div className="row g-3">
                <div className="col-md-4">
                  <StationAutocomplete
                    id="boarding"
                    label="Boarding Station"
                    value={boarding}
                    onChange={handleBoardingChange}
                    placeholder="Enter boarding station"
                    stations={stations}
                  />
                </div>
                <div className="col-md-4">
                  <StationAutocomplete
                    id="destination"
                    label="Destination Station"
                    value={destination}
                    onChange={setDestination}
                    placeholder={boarding ? "Enter destination station" : "Enter destination station"}
                    disabled={!boarding}
                    stations={stations}
                    excludeStation={boarding}
                  />
                </div>
                <div className="col-md-2">
                  <label
                    htmlFor="travelDate"
                    className="form-label"
                    style={{ fontFamily: "var(--font-mono)", fontSize: "0.80rem", textTransform: "normal", fontStyle:"italic" }}
                  >
                    Journey Date
                  </label>
                  <input
                    id="travelDate"
                    type="date"
                    className="form-control"
                    value={travelDate}
                    min={todayInputValue()}
                    onChange={(e) => setTravelDate(e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <button
                    type="submit"
                    className="btn btn-amber w-100"
                    disabled={searching || !boarding || !destination}
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>
            </form>
            {searchError && (
              <div className="alert alert-danger mt-3 mb-0">{searchError}</div>
            )}
          </div>
        </div>

        {/* Empty result  */}
        {searched && trains.length === 0 && (
          <div className="ticket-card">
            <div className="ticket-card__body text-center py-4 text-muted">
              No trains found between <strong>{boarding}</strong> and{" "}
              <strong>{destination}</strong>.
            </div>
          </div>
        )}

        {/* Train results */}
        {trains.length > 0 && (
          <>
            <h2 className="font-display mb-3" style={{ fontSize: "1.2rem" }}>
              {trains.length} Train{trains.length !== 1 ? "s" : ""} Found
            </h2>
            <div className="d-flex flex-column gap-3">
              {trains.map((train) => {
                const bHalt = train.boardingHalt;
                const dHalt = train.destinationHalt;
                const coachFares = (train.coaches || [])
                  .map((coach) => Number(coach.routeFare || 0))
                  .filter((fare) => fare > 0);
                const minFare = coachFares.length
                  ? Math.min(...coachFares)
                  : Number(train.routeFare || 0);
                const fareByCoachType = uniqueCoachFareOptions(train.coaches);
                return (
                  <div
                    key={train.id}
                    className="ticket-card"
                    style={{ cursor: "pointer" }}
                    onClick={() => handleTrainClick(train)}
                    title={user ? "Click to book" : "Login required to book"}
                  >
                    <div className="ticket-card__body">
                      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                        <div>
                          <span
                            className="font-display"
                            style={{ fontSize: "1.1rem", color: "var(--color-ink)" }}
                          >
                            {train.name}
                          </span>
                          <span
                            className="font-mono ms-2"
                            style={{ fontSize: "0.82rem", color: "var(--color-ink-soft)" }}
                          >
                            #{train.number}
                          </span>
                          <div className="mt-2 d-flex gap-4 flex-wrap">
                            <div>
                              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-soft)", textTransform: "uppercase" }}>
                                Departs
                              </div>
                              <div className="font-mono fw-semibold" style={{ color: "var(--color-ink)" }}>
                                {formatHaltDateTime(bHalt, "departureTime", train.boardingDate)}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>
                                {bHalt.stationName}
                              </div>
                            </div>
                            <div style={{ fontSize: "1.4rem", color: "var(--color-steel)", alignSelf: "center" }}>
                              →
                            </div>
                            <div>
                              <div style={{ fontSize: "0.72rem", color: "var(--color-ink-soft)", textTransform: "uppercase" }}>
                                Arrives
                              </div>
                              <div className="font-mono fw-semibold" style={{ color: "var(--color-ink)" }}>
                                {formatHaltDateTime(dHalt, "arrivalTime", train.destinationDate)}
                              </div>
                              <div style={{ fontSize: "0.85rem", color: "var(--color-ink-soft)" }}>
                                {dHalt.stationName}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <div
                            className="font-mono"
                            style={{ fontSize: "1rem", color: "var(--color-ink-soft)" }}
                          >
                            {train.coaches.length} coach{train.coaches.length !== 1 ? "es" : ""}
                          </div>
                          <div
                            className="font-mono fw-semibold"
                            style={{ fontSize: "0.92rem", color: "var(--color-ink)", marginTop: "0.25rem" }}
                          >
                            From ₹{minFare.toLocaleString("en-IN")}/seat
                          </div>
                          {fareByCoachType.length > 0 && (
                            <div style={{ fontSize: "0.75rem", color: "var(--color-ink-soft)" }}>
                              {fareByCoachType
                                .map((coach) => `${coach.type || coach.name} ₹${Number(coach.routeFare || 0).toLocaleString("en-IN")}`)
                                .join(" · ")}
                            </div>
                          )}
                          {train.durationText && (
                            <div style={{ fontSize: "0.78rem", color: "var(--color-ink-soft)" }}>
                              Duration {train.durationText}
                            </div>
                          )}
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color:    "var(--color-amber)",
                              marginTop: "0.3rem",
                            }}
                          >
                            {user ? "Click to book ›" : "Login to book ›"}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Booking modal */}
      {selectedTrain && (
        <BookingFlowModal
          train={selectedTrain}
          boarding={selectedTrain.boardingHalt?.stationName || boarding.trim()}
          destination={selectedTrain.destinationHalt?.stationName || destination.trim()}
          travelDate={selectedTrain.serviceDate || travelDate}
          onClose={() => setSelectedTrain(null)}
        />
      )}
    </div>
  );
}

