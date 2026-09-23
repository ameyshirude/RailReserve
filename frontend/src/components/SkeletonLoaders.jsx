import React from "react";

export const TrainSkeleton = () => (
  <div className="ticket-card mb-3 placeholder-glow" style={{ cursor: "default" }}>
    <div className="ticket-card__body">
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div style={{ flex: 1, minWidth: "200px" }}>
          {/* Train Name and Number */}
          <span className="placeholder col-4 rounded" style={{ height: "1.1rem", display: "inline-block" }}></span>
          <span className="placeholder col-2 ms-2 rounded" style={{ height: "0.82rem", display: "inline-block" }}></span>
          
          {/* Times and Stations */}
          <div className="mt-3 d-flex gap-4 flex-wrap">
            <div style={{ width: "100px" }}>
              <div className="placeholder col-8 rounded mb-1" style={{ height: "0.72rem", display: "block" }}></div>
              <div className="placeholder col-12 rounded mb-1" style={{ height: "1.1rem", display: "block" }}></div>
              <div className="placeholder col-10 rounded" style={{ height: "0.85rem", display: "block" }}></div>
            </div>
            <div style={{ fontSize: "1.4rem", color: "var(--color-steel)", alignSelf: "center", opacity: 0.5 }}>
              →
            </div>
            <div style={{ width: "100px" }}>
              <div className="placeholder col-8 rounded mb-1" style={{ height: "0.72rem", display: "block" }}></div>
              <div className="placeholder col-12 rounded mb-1" style={{ height: "1.1rem", display: "block" }}></div>
              <div className="placeholder col-10 rounded" style={{ height: "0.85rem", display: "block" }}></div>
            </div>
          </div>
        </div>
        
        {/* Right Side (Price and Duration) */}
        <div className="text-end" style={{ width: "150px" }}>
          <div className="placeholder col-6 rounded mb-2" style={{ height: "1rem", display: "block", marginLeft: "auto" }}></div>
          <div className="placeholder col-10 rounded mb-2" style={{ height: "1rem", display: "block", marginLeft: "auto" }}></div>
          <div className="placeholder col-12 rounded mb-2" style={{ height: "0.75rem", display: "block", marginLeft: "auto" }}></div>
          <div className="placeholder col-8 rounded" style={{ height: "0.78rem", display: "block", marginLeft: "auto", marginTop: "1rem" }}></div>
        </div>
      </div>
    </div>
  </div>
);

export const BookingSkeleton = () => (
  <div className="ticket-card mb-3 placeholder-glow">
    <div className="ticket-card__header d-flex justify-content-between align-items-start" style={{ padding: "0.9rem 1.25rem" }}>
      <div className="w-50">
        <span className="placeholder col-6 rounded" style={{ height: "1.2rem", display: "inline-block" }}></span>
        <span className="placeholder col-2 ms-2 rounded" style={{ height: "0.8rem", display: "inline-block" }}></span>
      </div>
      <span className="placeholder col-2 rounded" style={{ height: "1.2rem", display: "inline-block", borderRadius: "12px" }}></span>
    </div>
    <div className="ticket-perforation" />
    <div className="ticket-card__body" style={{ padding: "0.9rem 1.25rem" }}>
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap w-50">
        <span className="placeholder col-4 rounded" style={{ height: "1.1rem" }}></span>
        <span style={{ color: "var(--color-steel)", fontSize: "1.1rem", opacity: 0.5 }}>→</span>
        <span className="placeholder col-4 rounded" style={{ height: "1.1rem" }}></span>
      </div>
      
      <div className="row g-3 mb-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="col-6 col-md-3">
            <div className="placeholder col-6 rounded mb-2" style={{ height: "0.72rem", display: "block" }}></div>
            <div className="placeholder col-10 rounded" style={{ height: "1rem", display: "block" }}></div>
          </div>
        ))}
      </div>
      
      <div className="mt-3 pt-3" style={{ borderTop: "1px dashed #ccc" }}>
        <div className="placeholder col-2 rounded mb-2" style={{ height: "0.80rem", display: "block" }}></div>
        <div className="d-flex gap-2">
          <span className="placeholder col-3 rounded" style={{ height: "1.5rem", borderRadius: "20px" }}></span>
          <span className="placeholder col-3 rounded" style={{ height: "1.5rem", borderRadius: "20px" }}></span>
        </div>
      </div>
    </div>
  </div>
);

export const TableSkeleton = ({ columns = 5, rows = 3 }) => (
  <div className="ticket-card placeholder-glow">
    <div className="table-responsive">
      <table className="table mb-0">
        <thead style={{ background: "var(--color-paper-dark)" }}>
          <tr>
            {[...Array(columns)].map((_, i) => (
              <th key={i}>
                <span className="placeholder col-8 rounded" style={{ height: "0.78rem" }}></span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[...Array(rows)].map((_, i) => (
            <tr key={i}>
              {[...Array(columns)].map((_, j) => (
                <td key={j}>
                  <span className="placeholder col-10 rounded" style={{ height: "1rem" }}></span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export const StatCardSkeleton = () => (
  <div className="ticket-card p-3 text-center placeholder-glow">
    <div className="placeholder col-6 rounded mb-2" style={{ height: "2rem" }}></div>
    <div className="placeholder col-8 rounded" style={{ height: "1rem" }}></div>
  </div>
);
