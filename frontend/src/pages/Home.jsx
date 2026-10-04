import React, { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import TrainResultCard from "../components/TrainResultCard";
import { bookingUrl } from "../utils/bookingRoute";
import StationAutocomplete from "../components/StationAutocomplete";
import { TrainSkeleton } from "../components/SkeletonLoaders";
import "./Home.css";

const todayInputValue = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const { user }      = useAuth();
  const navigate      = useNavigate();
  const location      = useLocation();

  const [boarding,      setBoarding]     = useState("");
  const [destination,   setDestination]  = useState("");
  const [trains,        setTrains]       = useState([]);
  const [searched,      setSearched]     = useState(false);
  const [searching,     setSearching]    = useState(false);
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
    const pending = location.state?.search;
    if (!pending) return;

    let cancelled = false;
    const nextTravelDate = pending.travelDate || todayInputValue();

    async function restoreSearch() {
      setBoarding(pending.boarding);
      setDestination(pending.destination);
      setTravelDate(nextTravelDate);
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

        setTrains(data.trains);
        setSearched(true);
      } catch (err) {
        if (!cancelled) {
          setTrains([]);
          setSearched(true);
          toast.error(
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

    restoreSearch();

    return () => {
      cancelled = true;
    };
  }, [location.state, navigate]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!boarding.trim() || !destination.trim()) return;
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
      toast.error(err.response?.data?.message || "Search failed. Please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleTrainClick = (train) => {
    if (user) {
      navigate(bookingUrl(train, boarding, destination, travelDate));
    } else {
      sessionStorage.setItem(
        "pendingBooking",
        JSON.stringify({ train, boarding, destination, travelDate })
      );
      navigate("/login");
    }
  };

  return (
    <main className="home-page">
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
                    className="btn btn-primary w-100"
                    disabled={searching || !boarding || !destination}
                  >
                    {searching ? "Searching…" : "Search"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* Loading Skeletons */}
        {searching && (
          <div className="d-flex flex-column gap-3">
            {[1, 2, 3].map((i) => (
              <TrainSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty result  */}
        {searched && !searching && trains.length === 0 && (
          <div className="ticket-card">
            <div className="ticket-card__body text-center py-4 text-muted">
              No trains found between <strong>{boarding}</strong> and{" "}
              <strong>{destination}</strong>.
            </div>
          </div>
        )}

        {/* Train results */}
        {!searching && trains.length > 0 && (
          <>
            <h2 className="font-display mb-3" style={{ fontSize: "1.2rem" }}>
              {trains.length} Train{trains.length !== 1 ? "s" : ""} Found
            </h2>
            <div className="d-flex flex-column gap-3">
              {trains.map((train) => (
                <TrainResultCard key={train.id} train={train} onSelect={handleTrainClick} needsLogin={!user} />
              ))}
            </div>
          </>
        )}
      </div>


    </main>
  );
}

