import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosClient";
import { useAuth } from "../context/AuthContext";
import { BookingSkeleton } from "../components/SkeletonLoaders";
import MyBookingCard from "../components/MyBookingCard";
import { bookingCategory, filterBookings } from "../utils/bookingPresentation";
import "./Dashboard.css";

const VIEWS = [["all", "All"], ["upcoming", "Upcoming"], ["past", "Past"], ["cancelled", "Cancelled"], ["pending", "Pending"]];
const PAGE_SIZE = 6;

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("all");
  const [sort, setSort] = useState("upcoming");
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now);
  const resultsRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    apiClient.get("/bookings/my", { signal: controller.signal })
      .then(({ data }) => {
        if (!active) return;
        if (!Array.isArray(data.bookings)) throw new Error("Invalid bookings response");
        setBookings(data.bookings);
        setLoaded(true);
        setNow(Date.now());
      })
      .catch((err) => {
        if (!active) return;
        setError(err.response?.status === 401
          ? "Your session has expired. Sign in again to see your bookings."
          : "Could not load your bookings. Please try again.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [reload]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const counts = Object.fromEntries(VIEWS.map(([key]) => [key, key === "all" ? bookings.length : bookings.filter((booking) => bookingCategory(booking, now) === key).length]));
  const filtered = filterBookings(bookings, query, view, sort, now);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const filteredView = query.trim() || view !== "all";
  const resetFilters = () => { setQuery(""); setView("all"); setPage(1); };
  const changePage = (next) => {
    setPage(next);
    resultsRef.current?.focus();
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="my-bookings container">
      <header className="my-bookings__header">
        <div><h1>My bookings</h1><p>{user?.username ? `Welcome, ${user.username}. ` : ""}Your journeys and ticket details, in one place.</p></div>
        <div className="my-bookings__header-actions">
          <button className="btn my-bookings__refresh" type="button" onClick={() => setReload((value) => value + 1)} disabled={loading}>{loading && loaded ? "Refreshing…" : "Refresh bookings"}</button>
          <Link to="/" className="btn btn-primary">Search trains</Link>
        </div>
      </header>
      {error && <div className="my-bookings__error" role="alert">
        <p>{error}{loaded ? " Previously loaded bookings are shown below." : ""}</p>
        {error.includes("session") ? <Link to="/login" state={{ from: "/dashboard" }} className="btn btn-primary">Sign in again</Link>
          : <button type="button" className="btn btn-outline-secondary" onClick={() => setReload((value) => value + 1)} disabled={loading}>Try again</button>}
      </div>}
      {!loaded && loading ? <div role="status"><span className="visually-hidden">Loading your bookings…</span><div aria-hidden="true"><BookingSkeleton /><BookingSkeleton /></div></div>
        : loaded && bookings.length === 0 ? <section className="my-bookings__empty">
          <h2>Your next journey starts here</h2><p>You have no bookings yet. Find a train and choose your seats.</p><Link to="/" className="btn btn-primary">Book your first journey</Link>
        </section>
        : loaded && <>
          <section className="my-bookings__toolbar" aria-label="Find a booking">
            <div className="my-bookings__filters" role="group" aria-label="Booking status">
              {VIEWS.map(([key, label]) => <button key={key} type="button" className="my-bookings__filter" aria-pressed={view === key} onClick={() => { setView(key); setPage(1); }}>{label}<span>{counts[key]}</span></button>)}
            </div>
            <div className="my-bookings__controls">
              <div><label htmlFor="my-booking-search">Search bookings</label><input id="my-booking-search" type="search" className="form-control" placeholder="PNR, train, or station" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></div>
              <div><label htmlFor="my-booking-sort">Sort by</label><select id="my-booking-sort" className="form-select" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}>
                <option value="upcoming">Upcoming first</option><option value="journey">Journey date: newest first</option><option value="booked">Booked: newest first</option>
              </select></div>
              <button type="button" className="btn btn-outline-secondary" disabled={!filteredView} onClick={resetFilters}>Clear filters</button>
            </div>
          </section>
          <div className="my-bookings__result-info">
            <p role="status">{loading ? "Refreshing bookings…" : `${filtered.length} of ${bookings.length} booking${bookings.length === 1 ? "" : "s"}${filteredView ? " match your filters" : ""}`}</p>
            <p>All journey times are in IST.</p>
          </div>
          <section className="my-bookings__results" aria-label="Your bookings" aria-busy={loading} tabIndex={-1} ref={resultsRef}>
            {visible.length ? visible.map((booking) => <MyBookingCard key={booking.id} booking={booking} now={now} />)
              : <div className="my-bookings__empty"><h2>{query.trim() ? "No matching bookings" : `No ${view} bookings`}</h2><p>{query.trim() ? "Try another PNR, train name, or station." : "Choose another status to see the rest of your journeys."}</p><button type="button" className="btn btn-primary" onClick={resetFilters}>Show all bookings</button></div>}
          </section>
          {pages > 1 && <nav className="my-bookings__pagination" aria-label="Booking pages">
            <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} · Page {currentPage} of {pages}</span>
            <div><button type="button" className="btn btn-outline-secondary" aria-label="Previous page" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>Previous</button><button type="button" className="btn btn-outline-secondary" aria-label="Next page" disabled={currentPage === pages} onClick={() => changePage(currentPage + 1)}>Next</button></div>
          </nav>}
        </>}
    </main>
  );
}
