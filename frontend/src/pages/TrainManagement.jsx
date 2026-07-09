import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api/axiosClient";
import TrainFormModal from "../components/TrainFormModal";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatRunningDays(value) {
  try {
    const days = JSON.parse(value);
    if (Array.isArray(days) && days.length > 0) {
      return days.map((day) => DAY_LABELS[Number(day)]).filter(Boolean).join(", ");
    }
  } catch (_) {}
  return "Daily";
}

export default function TrainManagement() {
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTrain, setEditingTrain] = useState(null); // null = create mode
  const [deleteId, setDeleteId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const fetchTrains = async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get("/admin/trains");
      setTrains(data.trains);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load trains.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrains(); }, []);

  const handleSaved = () => {
    setModalOpen(false);
    setEditingTrain(null);
    fetchTrains();
  };

  const handleDelete = async (id) => {
    setDeleteError("");
    try {
      await apiClient.delete(`/admin/trains/${id}`);
      setDeleteId(null);
      fetchTrains();
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete train.");
    }
  };

  return (
    <div className="container py-5">
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display mb-1">Train Management</h1>
          <Link to="/admin-dashboard" className="small" style={{ color: "var(--color-paper)" }}>
            ← Back to Dashboard
          </Link>
        </div>
        <button
          className="btn btn-amber"
          onClick={() => { setEditingTrain(null); setModalOpen(true); }}
        >
          + Add Train
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border" style={{ color: "var(--color-amber)" }} role="status" />
        </div>
      ) : trains.length === 0 ? (
        <div className="ticket-card">
          <div className="ticket-card__body text-center py-5">
            <p className="text-muted mb-3">No trains added yet.</p>
            <button
              className="btn btn-amber"
              onClick={() => { setEditingTrain(null); setModalOpen(true); }}
            >
              Add the first train
            </button>
          </div>
        </div>
      ) : (
        <div className="ticket-card">
          <div className="table-responsive">
            <table className="table mb-0" style={{ color: "var(--color-ink)" }}>
              <thead style={{ background: "var(--color-paper-dark)" }}>
                <tr>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Number</th>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Name</th>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Days</th>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Halts</th>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Coaches</th>
                  <th style={{ fontFamily: "var(--font-mono)", fontSize: "0.78rem", textTransform: "uppercase" }}>Bookings</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {trains.map((train) => (
                  <tr key={train.id}>
                    <td className="font-mono fw-semibold">{train.number}</td>
                    <td>{train.name}</td>
                    <td>
                      <span className="text-muted small">{formatRunningDays(train.runningDays)}</span>
                    </td>
                    <td>
                      <span className="text-muted small">
                        {train.halts.map((h) => h.stationName).join(" → ")}
                      </span>
                    </td>
                    <td>
                      {train.coaches.map((c) => (
                        <span
                          key={c.id}
                          className="badge me-1"
                          style={{ background: "var(--color-navy-3)", color: "var(--color-paper)", fontFamily: "var(--font-mono)" }}
                        >
                          {c.name} · {c.type} ({c.totalSeats})
                        </span>
                      ))}
                    </td>
                    <td>{train._count?.bookings ?? 0}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => { setEditingTrain(train); setModalOpen(true); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => { setDeleteId(train.id); setDeleteError(""); }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteId !== null && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1050 }} onClick={() => setDeleteId(null)} />
          <div className="modal fade show d-block" style={{ zIndex: 1055 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered modal-sm">
              <div className="modal-content ticket-card">
                <div className="ticket-card__header">
                  <h5 className="modal-title font-display mb-0">Delete Train?</h5>
                </div>
                <div className="ticket-perforation" />
                <div className="ticket-card__body">
                  {deleteError && <div className="alert alert-danger small py-2">{deleteError}</div>}
                  <p className="text-muted mb-3">
                    This will permanently delete the train and all associated coaches, halts, and bookings.
                  </p>
                  <div className="d-flex gap-2">
                    <button className="btn btn-danger flex-fill" onClick={() => handleDelete(deleteId)}>
                      Yes, delete
                    </button>
                    <button className="btn btn-outline-secondary flex-fill" onClick={() => setDeleteId(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <TrainFormModal
        show={modalOpen}
        train={editingTrain}
        onClose={() => { setModalOpen(false); setEditingTrain(null); }}
        onSaved={handleSaved}
      />
    </div>
  );
}
