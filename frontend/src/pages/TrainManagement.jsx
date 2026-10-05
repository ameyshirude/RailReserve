import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import apiClient from "../api/axiosClient";
import TrainFormModal from "../components/TrainFormModal";
import TrainDeleteDialog from "../components/TrainDeleteDialog";
import { TrainRouteDetails, TrainCoachDetails } from "../components/AdminTrainDetails";
import { WEEK_DAYS, filterAdminTrains, formatRunningDays } from "../utils/adminTrains";
import "./TrainManagement.css";

const EMPTY_FILTERS = { query: "", day: "", coachClass: "", bookings: "" };

function TrainActions({ train, onEdit, onDelete }) {
  return (
    <div className="admin-trains__actions">
      <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`Edit ${train.name}, ${train.number}`} onClick={() => onEdit(train)}>Edit</button>
      <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Delete ${train.name}, ${train.number}`} onClick={() => onDelete(train)}>Delete</button>
    </div>
  );
}

export default function TrainManagement() {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrain, setEditingTrain] = useState(null);
  const [deletingTrain, setDeletingTrain] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const requestRef = useRef(0);
  const resultsRef = useRef(null);

  const fetchTrains = useCallback(async () => {
    const request = ++requestRef.current;
    setLoading(true);
    setLoadError("");
    try {
      const { data } = await apiClient.get("/admin/trains");
      if (request === requestRef.current) setTrains(data.trains);
    } catch (err) {
      if (request === requestRef.current) setLoadError(err.response?.data?.message || "Couldn’t load trains. Please try again.");
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrains();
    return () => { requestRef.current += 1; };
  }, [fetchTrains]);

  // Filter before pagination so searches include every train in the catalog.
  const filtered = useMemo(() => filterAdminTrains(trains, filters), [trains, filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleTrains = filtered.slice(pageStart, pageStart + pageSize);
  const hasFilters = Boolean(filters.query || filters.day || filters.coachClass || filters.bookings);
  const coachClasses = useMemo(() => [...new Set(["SL", "3A", "2A", "1A", ...trains.flatMap((train) => (train.coaches || []).map((coach) => coach.type))])], [trains]);

  useEffect(() => { setPage((value) => Math.min(value, pageCount)); }, [pageCount]);

  const updateFilter = (field, value) => {
    setFilters((previous) => ({ ...previous, [field]: value }));
    setPage(1);
  };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };
  const openEditor = (train = null) => { setEditingTrain(train); setModalOpen(true); };
  const openDelete = (train) => { setDeleteError(""); setDeletingTrain(train); };
  const changePage = (nextPage) => {
    setPage(nextPage);
    resultsRef.current?.focus({ preventScroll: true });
    resultsRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  };

  const handleSaved = () => {
    setModalOpen(false);
    setEditingTrain(null);
    toast.success("Train saved successfully.");
    fetchTrains();
  };

  const handleDelete = async () => {
    if (!deletingTrain || deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await apiClient.delete(`/admin/trains/${deletingTrain.id}`);
      setTrains((previous) => previous.filter((train) => train.id !== deletingTrain.id));
      setDeletingTrain(null);
      toast.success("Train deleted successfully.");
      resultsRef.current?.focus({ preventScroll: true });
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete train. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="admin-trains container py-4 py-md-5">
      <header className="admin-trains__heading">
        <div>
          <Link to="/admin-dashboard" className="admin-trains__back">← Back to dashboard</Link>
          <h1>Train management</h1>
          <p>Find a service, review its route, and manage its schedule and coaches.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => openEditor()}>+ Add train</button>
      </header>

      <section className="admin-trains__toolbar" aria-label="Search and filter trains">
        <div className="admin-trains__search">
          <label htmlFor="admin-train-search">Search trains</label>
          <input id="admin-train-search" type="search" className="form-control" placeholder="Name, train number, or station" value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} />
        </div>
        <div>
          <label htmlFor="admin-train-day">Running day</label>
          <select id="admin-train-day" className="form-select" value={filters.day} onChange={(event) => updateFilter("day", event.target.value)}>
            <option value="">Any day</option>
            <option value="daily">Daily services</option>
            {WEEK_DAYS.map((day, index) => <option key={day} value={index}>{day}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="admin-train-class">Coach class</label>
          <select id="admin-train-class" className="form-select" value={filters.coachClass} onChange={(event) => updateFilter("coachClass", event.target.value)}>
            <option value="">All classes</option>
            {coachClasses.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="admin-train-bookings">Booking history</label>
          <select id="admin-train-bookings" className="form-select" value={filters.bookings} onChange={(event) => updateFilter("bookings", event.target.value)}>
            <option value="">All trains</option>
            <option value="with">Has history</option>
            <option value="without">No history</option>
          </select>
        </div>
        <button type="button" className="btn btn-outline-secondary" disabled={!hasFilters} onClick={clearFilters}>Clear filters</button>
      </section>

      <section className="admin-trains__results" aria-labelledby="admin-trains-results-title" aria-busy={loading}>
        <div className="admin-trains__results-heading">
          <h2 id="admin-trains-results-title" ref={resultsRef} tabIndex={-1}>Train directory</h2>
          <p role="status" aria-live="polite" aria-atomic="true">
            {loading ? "Loading trains…" : loadError ? "Unable to load trains" : `${filtered.length} of ${trains.length} trains${hasFilters ? " match your filters" : ""}`}
          </p>
        </div>
        {loading ? (
          <div className="admin-trains__loading" aria-hidden="true">
            {[1, 2, 3].map((item) => <div key={item} className="placeholder-glow"><span className="placeholder col-7 rounded" /><span className="placeholder col-4 rounded" /></div>)}
          </div>
        ) : loadError ? (
          <div className="admin-trains__empty" role="alert"><h3>Trains couldn’t be loaded</h3><p>{loadError}</p><button className="btn btn-primary" onClick={fetchTrains}>Retry</button></div>
        ) : trains.length === 0 ? (
          <div className="admin-trains__empty"><h3>Your train directory is empty</h3><p>Add a train with its route, schedule, and coaches to get started.</p><button className="btn btn-primary" onClick={() => openEditor()}>Add the first train</button></div>
        ) : filtered.length === 0 ? (
          <div className="admin-trains__empty"><h3>No matching trains</h3><p>Try another name, number, or station, or clear your filters.</p><button className="btn btn-primary" onClick={clearFilters}>Show all trains</button></div>
        ) : (
          <>
            <div className="admin-trains__desktop">
              <table className="admin-trains__table">
                <caption className="visually-hidden">Trains with routes, running days, coach classes, booking counts, and management actions</caption>
                <thead><tr><th scope="col">Train</th><th scope="col">Route</th><th scope="col">Running days</th><th scope="col">Coaches</th><th scope="col">Bookings</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  {visibleTrains.map((train) => (
                    <tr key={train.id}>
                      <th scope="row"><span className="admin-trains__number">#{train.number}</span><span className="admin-trains__name">{train.name}</span></th>
                      <td><TrainRouteDetails train={train} /></td>
                      <td><span className="admin-trains__schedule">{formatRunningDays(train.runningDays)}</span></td>
                      <td><TrainCoachDetails train={train} /></td>
                      <td className="admin-trains__count">{train._count?.bookings ?? 0}</td>
                      <td><TrainActions train={train} onEdit={openEditor} onDelete={openDelete} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="admin-trains__mobile" aria-label="Trains">
              {visibleTrains.map((train) => (
                <li key={train.id}>
                  <article className="admin-train-card" aria-label={`${train.name}, ${train.number}`}>
                    <header><span className="admin-trains__number">#{train.number}</span><h3>{train.name}</h3></header>
                    <TrainRouteDetails train={train} />
                    <dl className="admin-train-card__facts">
                      <div><dt>Running days</dt><dd>{formatRunningDays(train.runningDays)}</dd></div>
                      <div><dt>Bookings</dt><dd>{train._count?.bookings ?? 0}</dd></div>
                    </dl>
                    <TrainCoachDetails train={train} />
                    <TrainActions train={train} onEdit={openEditor} onDelete={openDelete} />
                  </article>
                </li>
              ))}
            </ul>
            <footer className="admin-trains__pagination">
              <p>Showing {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} of {filtered.length} trains</p>
              <div className="admin-trains__page-size"><label htmlFor="admin-train-page-size">Per page</label><select id="admin-train-page-size" className="form-select" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
              <nav aria-label="Train directory pages">
                <button className="btn btn-outline-secondary" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous page">← <span>Previous</span></button>
                <span className="admin-trains__page-status" role="status" aria-live="polite">Page {currentPage} of {pageCount}</span>
                <button className="btn btn-outline-secondary" disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)} aria-label="Next page"><span>Next</span> →</button>
              </nav>
            </footer>
          </>
        )}
      </section>
      {deletingTrain && <TrainDeleteDialog train={deletingTrain} deleting={deleting} error={deleteError} onClose={() => setDeletingTrain(null)} onConfirm={handleDelete} />}
      <TrainFormModal show={modalOpen} train={editingTrain} onClose={() => { setModalOpen(false); setEditingTrain(null); }} onSaved={handleSaved} />
    </main>
  );
}
