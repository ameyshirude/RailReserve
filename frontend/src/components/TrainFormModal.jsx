import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import apiClient from "../api/axiosClient";

const emptyHalt  = () => ({
  stationName: "",
  arrivalTime: "",
  departureTime: "",
  arrivalDay: "1",
  departureDay: "1",
  distance: "",
});
const COACH_TYPES = ["SL", "3A", "2A", "1A"];
const emptyCoach = () => ({ name: "", type: "SL", totalSeats: "" });
const WEEK_DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];
const ALL_DAYS = WEEK_DAYS.map((day) => day.value);

function parseRunningDays(value) {
  try {
    const days = JSON.parse(value);
    return Array.isArray(days) && days.length > 0 ? days.map(Number) : ALL_DAYS;
  } catch (_) {
    return ALL_DAYS;
  }
}

export default function TrainFormModal({ show, train, onClose, onSaved }) {
  const isEdit = Boolean(train);
  const [name,      setName]      = useState("");
  const [number,    setNumber]    = useState("");
  const [halts,     setHalts]     = useState([emptyHalt(), emptyHalt()]);
  const [coaches,   setCoaches]   = useState([emptyCoach()]);
  const [runningDays, setRunningDays] = useState(ALL_DAYS);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (show && train) {
      setName(train.name);
      setNumber(train.number);
      setHalts(
        train.halts.length > 0
          ? train.halts.map((h) => ({
              stationName:   h.stationName,
              arrivalTime:   h.arrivalTime   || "",
              departureTime: h.departureTime || "",
              arrivalDay:    String(h.arrivalDay || 1),
              departureDay:  String(h.departureDay || 1),
              distance:      String(h.distance ?? ""),
            }))
          : [emptyHalt(), emptyHalt()]
      );
      setCoaches(
        train.coaches.length > 0
          ? train.coaches.map((c) => ({
              id:         c.id,
              name:       c.name,
              type:       c.type,
              totalSeats: String(c.totalSeats),
            }))
          : [emptyCoach()]
      );
      setRunningDays(parseRunningDays(train.runningDays));
    } else if (show && !train) {
      setName(""); setNumber("");
      setHalts([emptyHalt(), emptyHalt()]);
      setCoaches([emptyCoach()]);
      setRunningDays(ALL_DAYS);
    }

  }, [show, train]);

  if (!show) return null;

  const updateHalt  = (i, f, v) => setHalts((p)   => p.map((h, idx) => idx === i ? { ...h, [f]: v } : h));
  const addHalt     = ()        => setHalts((p)   => [...p, emptyHalt()]);
  const removeHalt  = (i)       => setHalts((p)   => p.filter((_, idx) => idx !== i));

  const updateCoach  = (i, f, v) => setCoaches((p) => p.map((c, idx) => idx === i ? { ...c, [f]: v } : c));
  const addCoach     = ()        => setCoaches((p) => [...p, emptyCoach()]);
  const removeCoach  = (i)       => setCoaches((p) => p.filter((_, idx) => idx !== i));
  const toggleRunningDay = (day) =>
    setRunningDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b)
    );

  const handleSubmit = async (e) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const normalizedHalts = halts.map((halt, i) => ({
        ...halt,
        distance: i === 0 ? 0 : halt.distance,
      }));
      const payload = { name, number, runningDays, halts: normalizedHalts, coaches };
      if (isEdit) {
        await apiClient.put(`/admin/trains/${train.id}`, payload);
      } else {
        await apiClient.post("/admin/trains", payload);
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save train.");
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle = {
    fontFamily:    "var(--font-mono)",
    fontSize:      "0.78rem",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} style={{ zIndex: 1050 }} />
      <div className="modal fade show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
        <div className="modal-dialog modal-xl modal-dialog-scrollable">
          <div
            className="modal-content"
            style={{ background: "var(--color-paper)", color: "var(--color-ink)" }}
          >
            <div
              className="modal-header"
              style={{
                background:   "var(--color-navy-2)",
                color:        "var(--color-paper)",
                borderBottom: "2px solid var(--action-primary)",
              }}
            >
              <h5 className="modal-title font-display">
                {isEdit ? "Edit the Train" : "Add a New Train"}
              </h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                onClick={onClose}
                aria-label="Close"
              />
            </div>

            <div className="modal-body">

              <form onSubmit={handleSubmit} id="trainForm" noValidate>
                {/* Basic info */}
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <label className="form-label" style={labelStyle}>Train Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Rajdhani Express"
                      required
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" style={labelStyle}>Train Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="e.g. 22222"
                      required
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <h6 className="font-display mb-2">Running Days</h6>
                  <div className="d-flex flex-wrap gap-2">
                    {WEEK_DAYS.map((day) => {
                      const checked = runningDays.includes(day.value);
                      return (
                        <label
                          key={day.value}
                          className="btn btn-sm"
                          style={{
                            border:     `1px solid ${checked ? "var(--action-primary)" : "#ccc"}`,
                            background: checked ? "var(--action-soft)" : "var(--color-paper-dark)",
                            color:      checked ? "var(--color-ink)" : "var(--color-ink-soft)",
                            textDecoration: checked ? "none" : "line-through",
                            fontFamily: "var(--font-mono)",
                            minWidth:   "54px",
                          }}
                        >
                          <input
                            type="checkbox"
                            className="visually-hidden"
                            checked={checked}
                            onChange={() => toggleRunningDay(day.value)}
                          />
                          {day.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Halts */} 
                <div className="mb-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="font-display mb-0">Halts</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={addHalt}
                    >
                      + Add Halt
                    </button>
                  </div>
                  {halts.map((halt, i) => (
                    <div
                      key={i}
                      className="p-3 mb-2 rounded"
                      style={{ background: "var(--color-paper-dark)", border: "1px solid #ddd" }}
                    >
                      <div className="row g-2 align-items-end">
                        <div className="col-12 col-md-1 text-center">
                          <span className="font-mono fw-bold" style={{ color: "var(--color-ink-soft)" }}>
                            {i + 1}
                          </span>
                        </div>
                        <div className="col-12 col-md-2">
                          <label className="form-label small mb-1">Station Name</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={halt.stationName}
                            onChange={(e) => updateHalt(i, "stationName", e.target.value)}
                            placeholder={
                              i === 0 ? "Origin" : i === halts.length - 1 ? "Terminus" : "Stop"
                            }
                            required
                          />
                        </div>
                        <div className="col-6 col-md-1">
                          <label className="form-label small mb-1">Arr Day</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={halt.arrivalDay}
                            onChange={(e) => updateHalt(i, "arrivalDay", e.target.value)}
                            min="1"
                            disabled={i === 0}
                          />
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="form-label small mb-1">Arrival</label>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={halt.arrivalTime}
                            onChange={(e) => updateHalt(i, "arrivalTime", e.target.value)}
                            disabled={i === 0}
                          />
                        </div>
                        <div className="col-6 col-md-1">
                          <label className="form-label small mb-1">Dep Day</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={halt.departureDay}
                            onChange={(e) => updateHalt(i, "departureDay", e.target.value)}
                            min="1"
                            disabled={i === halts.length - 1}
                          />
                        </div>
                        <div className="col-6 col-md-2">
                          <label className="form-label small mb-1">Departure</label>
                          <input
                            type="time"
                            className="form-control form-control-sm"
                            value={halt.departureTime}
                            onChange={(e) => updateHalt(i, "departureTime", e.target.value)}
                            disabled={i === halts.length - 1}
                          />
                        </div>
                        <div className="col-12 col-md-2">
                          <label className="form-label small mb-1">Distance from Origin (km)</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            value={i === 0 ? "0" : halt.distance}
                            onChange={(e) => updateHalt(i, "distance", e.target.value)}
                            min="0"
                            step="0.01"
                            disabled={i === 0}
                            placeholder={i === 0 ? "Origin" : "Distance"}
                            required={i > 0}
                          />
                        </div>
                        <div className="col-12 col-md-1">
                          {halts.length > 2 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger w-100"
                              onClick={() => removeHalt(i)}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coaches */}
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="font-display mb-0">Coaches</h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={addCoach}
                    >
                      + Add Coach
                    </button>
                  </div>
                  <div className="row g-2">
                    {coaches.map((coach, i) => (
                      <div className="col-md-6 col-lg-4" key={coach.id ?? `new-${i}`}>
                        <div
                          className="p-3 rounded"
                          style={{ background: "var(--color-paper-dark)", border: "1px solid #ddd" }}
                        >
                          <div className="mb-2">
                            <label className="form-label small mb-1">Coach Name</label>
                            <input
                              type="text"
                              className="form-control form-control-sm"
                              value={coach.name}
                              onChange={(e) => updateCoach(i, "name", e.target.value)}
                              maxLength="30"
                              placeholder="e.g. S1, S2, B1"
                              required
                            />
                          </div>
                          <div className="mb-2">
                            <label className="form-label small mb-1">Coach Type</label>
                            <select
                              className="form-select form-select-sm"
                              value={coach.type}
                              onChange={(e) => updateCoach(i, "type", e.target.value)}
                              required
                            >
                              {COACH_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-12">
                              <label className="form-label small mb-1">Total Seats</label>
                              <input
                                type="number"
                                className="form-control form-control-sm"
                                value={coach.totalSeats}
                                onChange={(e) => updateCoach(i, "totalSeats", e.target.value)}
                                min="1"
                                max="999"
                                placeholder="e.g. 72"
                                required
                              />
                            </div>
                          </div>
                          {coaches.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger w-100"
                              onClick={() => removeCoach(i)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>
            </div>

            <div className="modal-footer" style={{ background: "var(--color-paper-dark)" }}>
              <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                form="trainForm"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Saving..." : isEdit ? "Save Changes" : "Create Train"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
