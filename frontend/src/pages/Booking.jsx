import React, { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import BookingFlow from "../components/BookingFlow";
import "../components/BookingFlow.css";

export default function Booking() {
  const { trainId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const boarding = params.get("boarding") || "";
  const destination = params.get("destination") || "";
  const date = params.get("date") || "";
  const [train, setTrain] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [trainId, boarding, destination, date]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setTrain(null);
    setError("");
    if (!boarding || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("This booking link is incomplete. Search for your journey again.");
      setLoading(false);
      return;
    }
    apiClient.get("/trains/search", { params: { boarding, destination, date } })
      .then(({ data }) => {
        if (cancelled) return;
        const match = data.trains.find((item) => String(item.id) === trainId);
        if (!match) setError("This train is no longer available for this journey. Please choose another train.");
        else setTrain(match);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "We couldn’t load your journey. Please try again.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [trainId, boarding, destination, date, attempt]);

  const search = { boarding, destination, travelDate: date };
  return (
    <main className="booking-page container py-4 py-md-5">
      <Link className="booking-back" to="/" state={{ search }}>← Back to train results</Link>
      <header className="booking-page__heading">
        <p className="booking-eyebrow">Your next journey</p>
        <h1>Book your journey</h1>
        <p>Choose your coach, add passengers, and confirm your ticket.</p>
      </header>
      {loading && <div className="booking-panel p-5" role="status">Loading your journey…</div>}
      {error && <div className="booking-panel p-4" role="alert"><p>{error}</p><button className="btn btn-primary" onClick={() => setAttempt((value) => value + 1)}>Try again</button></div>}
      {train && !loading && (
        <BookingFlow
          key={`${user.id}:${trainId}:${boarding}:${destination}:${date}`}
          draftKey={`railreserve:booking:${user.id}:${trainId}:${boarding}:${destination}:${date}`}
          train={train}
          boarding={train.boardingHalt.stationName}
          destination={train.destinationHalt.stationName}
          travelDate={train.serviceDate || date}
        />
      )}
    </main>
  );
}
