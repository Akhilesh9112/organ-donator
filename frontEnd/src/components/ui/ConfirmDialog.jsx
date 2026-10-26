import React from "react";
import Modal from "./Modal";
import Button from "./Button";
export default function ConfirmDialog({
  title,
  message,
  onConfirm,
  onClose,
  busy,
  error,
}) {
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <p>{message}</p>
      {error && (
        <p className="care-error" role="alert">
          {error}
        </p>
      )}
      <div className="care-form-actions">
        <Button secondary onClick={onClose} disabled={busy}>
          Go back
        </Button>
        <Button busy={busy} onClick={onConfirm}>
          Confirm
        </Button>
      </div>
    </Modal>
  );
}
