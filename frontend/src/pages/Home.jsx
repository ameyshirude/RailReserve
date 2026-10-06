import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import TrainResultCard from "../components/TrainResultCard";
import { bookingUrl, formatJourneyDate } from "../utils/bookingRoute";
import { localDate, normalizeSort, searchParams, SORT_OPTIONS, sortTrains, validateSearch } from "../utils/trainSearch";
import StationAutocomplete from "../components/StationAutocomplete";
import { TrainSkeleton } from "../components/SkeletonLoaders";
import "./Home.css";

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const urlBoarding = params.get("boarding") || "";
  const urlDestination = params.get("destination") || "";
  const urlDate = params.get("date") || "";
  const sort = normalizeSort(params.get("sort"));
  const hasSearch = params.has("boarding") || params.has("destination") || params.has("date");
  const queryKey = JSON.stringify([urlBoarding, urlDestination, urlDate]);
  const [form, setForm] = useState(() => ({ boarding: urlBoarding, destination: urlDestination, travelDate: hasSearch ? urlDate : localDate() }));
  const [errors, setErrors] = useState({});
  const [stations, setStations] = useState([]);
  const [stationStatus, setStationStatus] = useState("loading");
  const [stationAttempt, setStationAttempt] = useState(0);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [result, setResult] = useState({ key: "", status: "idle", trains: [], error: "" });
  const [today, setToday] = useState(localDate);

  // Keep date shortcuts current when the tab stays open across local midnight.
  useEffect(() => {
    const update = () => setToday(localDate());
    const timer = setInterval(update, 60000);
    window.addEventListener("focus", update);
    return () => { clearInterval(timer); window.removeEventListener("focus", update); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStationStatus("loading");
    apiClient.get("/stations")
      .then(({ data }) => { if (!cancelled) { setStations(data.stations); setStationStatus("ready"); } })
      .catch(() => { if (!cancelled) setStationStatus("error"); });
    return () => { cancelled = true; };
  }, [stationAttempt]);

  // Only submitted URL changes reset the form; sorting preserves draft edits.
  useEffect(() => {
    setForm({ boarding: urlBoarding, destination: urlDestination, travelDate: hasSearch ? urlDate : localDate() });
    setErrors({});
  }, [urlBoarding, urlDestination, urlDate, hasSearch]);

  useEffect(() => {
    if (!hasSearch || stationStatus !== "ready") return;
    const { errors: nextErrors, search } = validateSearch({ boarding: urlBoarding, destination: urlDestination, travelDate: urlDate }, stations, today);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setResult({ key: queryKey, status: "invalid", trains: [], error: "" });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setResult({ key: queryKey, status: "loading", trains: [], error: "" });
    apiClient.get("/trains/search", {
      params: { boarding: search.boarding, destination: search.destination, date: search.travelDate },
      signal: controller.signal,
    }).then(({ data }) => {
      if (!cancelled) setResult({ key: queryKey, status: "success", trains: data.trains, error: "" });
    }).catch((err) => {
      if (!cancelled) setResult({ key: queryKey, status: "error", trains: [], error: err.response?.data?.message || "We couldn’t load trains for this journey. Please try again." });
    });
    return () => { cancelled = true; controller.abort(); };
  }, [hasSearch, urlBoarding, urlDestination, urlDate, queryKey, stations, stationStatus, searchAttempt, today]);

  const status = !hasSearch || stationStatus !== "ready" ? "idle" : result.key === queryKey ? result.status : "loading";
  const sortedTrains = useMemo(() => sortTrains(result.trains, sort), [result.trains, sort]);
  const dirty = hasSearch && (form.boarding.trim().toLowerCase() !== urlBoarding.trim().toLowerCase() || form.destination.trim().toLowerCase() !== urlDestination.trim().toLowerCase() || form.travelDate !== urlDate);

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "", ...(field === "boarding" ? { destination: "" } : {}) }));
  };
  const swapStations = () => {
    setForm((previous) => ({ ...previous, boarding: previous.destination, destination: previous.boarding }));
    setErrors((previous) => ({ ...previous, boarding: "", destination: "" }));
  };
  const handleSearch = (event) => {
    event.preventDefault();
    if (stationStatus !== "ready") return;
    const { errors: nextErrors, search } = validateSearch(form, stations);
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) { document.getElementById(firstError)?.focus(); return; }
    if (urlBoarding === search.boarding && urlDestination === search.destination && urlDate === search.travelDate) {
      setForm(search);
      setSearchAttempt((attempt) => attempt + 1);
    } else setParams(searchParams(search, sort));
  };

  const handleTrainClick = (train) => {
    const route = bookingUrl(train, urlBoarding, urlDestination, urlDate, sort);
    if (user) navigate(route);
    else {
      try {
        sessionStorage.setItem("pendingBooking", JSON.stringify({ train, boarding: urlBoarding, destination: urlDestination, travelDate: urlDate, sort }));
      } catch { /* Login also restores the journey from navigation state. */ }
      navigate("/login", { state: { from: route } });
    }
  };

  return (
    <main className="home-page">
      <div className="container py-4 py-md-5">
        <section className="ticket-card search-card mb-4" aria-labelledby="train-search-title">
          <header className="ticket-card__header">
            <h1 id="train-search-title">Find your train</h1>
            <p>Choose your stations and date to compare journeys.</p>
          </header>
          <div className="ticket-card__body">
            <form onSubmit={handleSearch} noValidate aria-label="Train search">
              <div className="train-search-form">
                <StationAutocomplete id="boarding" label="Boarding station" value={form.boarding} onChange={(value) => updateField("boarding", value)} placeholder="Enter boarding station" stations={stations} error={errors.boarding} />
                <button className="search-swap" type="button" onClick={swapStations} aria-label="Swap boarding and destination stations" title="Swap stations" disabled={!form.boarding && !form.destination}><span aria-hidden="true">⇄</span></button>
                <StationAutocomplete id="destination" label="Destination station" value={form.destination} onChange={(value) => updateField("destination", value)} placeholder="Enter destination station" stations={stations} excludeStation={form.boarding.trim()} error={errors.destination} />
                <div className="search-date">
                  <label htmlFor="travelDate" className="form-label">Journey date</label>
                  <input id="travelDate" type="date" className={`form-control${errors.travelDate ? " is-invalid" : ""}`} value={form.travelDate} min={today} onChange={(event) => updateField("travelDate", event.target.value)} aria-invalid={Boolean(errors.travelDate)} aria-describedby={errors.travelDate ? "travelDate-error" : undefined} required />
                  {errors.travelDate && <p id="travelDate-error" className="search-field-error">{errors.travelDate}</p>}
                  <div className="search-date__shortcuts" role="group" aria-label="Journey date shortcuts">
                    <button type="button" aria-pressed={form.travelDate === today} onClick={() => { setToday(localDate()); updateField("travelDate", localDate()); }}>Today</button>
                    <button type="button" aria-pressed={form.travelDate === localDate(1)} onClick={() => updateField("travelDate", localDate(1))}>Tomorrow</button>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary search-submit" disabled={stationStatus !== "ready" || (status === "loading" && !dirty)}>{status === "loading" && !dirty ? "Searching…" : "Search trains"}</button>
              </div>
              {Object.values(errors).some(Boolean) && <p className="search-validation" role="alert">Please check the highlighted fields before searching.</p>}
            </form>
            {stationStatus === "loading" && <p className="search-help" role="status">Loading station suggestions…</p>}
            {stationStatus === "error" && <div className="search-notice" role="alert"><p>Station suggestions couldn’t be loaded. Please try again.</p><button className="btn btn-outline-secondary" onClick={() => setStationAttempt((attempt) => attempt + 1)}>Retry stations</button></div>}
          </div>
        </section>
        {dirty && status === "success" && <p className="search-draft-notice" role="status">Your search details have changed. Select “Search trains” to update the results below.</p>}
        <section aria-label="Train search results" aria-busy={status === "loading"}>
          {status === "loading" && <><p role="status">Finding trains for your journey…</p><div aria-hidden="true">{[1, 2, 3].map((index) => <TrainSkeleton key={index} />)}</div></>}
          {status === "error" && <div className="ticket-card p-4 search-notice" role="alert"><h2>Search couldn’t be completed</h2><p>{result.error}</p><button className="btn btn-primary" onClick={() => setSearchAttempt((attempt) => attempt + 1)}>Retry search</button></div>}
          {status === "success" && <>
            <div className="search-results-heading">
              <div><h2 role="status" aria-live="polite">{sortedTrains.length} train{sortedTrains.length === 1 ? "" : "s"} found</h2><p>{urlBoarding} → {urlDestination} · {formatJourneyDate(urlDate)}</p></div>
              {sortedTrains.length > 0 && <div className="search-sort"><label htmlFor="train-sort">Sort by</label><select id="train-sort" className="form-select" value={sort} onChange={(event) => { const next = new URLSearchParams(params); next.set("sort", event.target.value); setParams(next, { replace: true }); }}>{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}
            </div>
            {sortedTrains.length === 0 ? <div className="ticket-card p-4 search-empty"><h3>No trains on this route for the selected date</h3><p>Try another date or swap your stations and search again.</p></div> : <div className="d-flex flex-column gap-3">{sortedTrains.map((train) => <TrainResultCard key={train.id} train={train} onSelect={handleTrainClick} needsLogin={!user} />)}</div>}
          </>}
        </section>
      </div>
    </main>
  );
}
