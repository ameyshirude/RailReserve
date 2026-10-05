import React, { useEffect, useRef } from "react";

export default function TrainDeleteDialog({ train, deleting, error, onClose, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog ref={dialogRef} className="admin-delete-dialog" aria-labelledby="delete-train-title" aria-describedby="delete-train-description"
      onCancel={(event) => { event.preventDefault(); if (!deleting) onClose(); }}>
      <h2 id="delete-train-title">Delete train?</h2>
      <p><strong>{train.name}</strong> · #{train.number}</p>
      <p id="delete-train-description">This permanently removes the train, its coaches, and its halts. Trains with booking history cannot be deleted.</p>
      {error && <p className="admin-trains__error" role="alert">{error}</p>}
      <div className="admin-delete-dialog__actions">
        <button ref={cancelRef} type="button" className="btn btn-outline-secondary" disabled={deleting} onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-danger" disabled={deleting} onClick={onConfirm}>{deleting ? "Deleting…" : "Delete train"}</button>
      </div>
    </dialog>
  );
}
