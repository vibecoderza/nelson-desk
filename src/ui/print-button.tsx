"use client";

export function PrintButton({ label, next = false }: { label: string; next?: boolean }) {
  return <button type="button" className={`btn${next ? " is-next" : ""}`} onClick={() => window.print()}>{label}</button>;
}
