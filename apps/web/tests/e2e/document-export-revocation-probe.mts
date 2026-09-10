if (process.env.AAKD_DOCUMENT_EXPORT_PROBE !== "1") {
  throw new Error("Opt in with AAKD_DOCUMENT_EXPORT_PROBE=1")
}

// Compatibility entry point: the lifecycle probe now includes the original
// revocation/source-change checks plus durable publication and cleanup races.
process.env.AAKD_DOCUMENT_EXPORT_LIFECYCLE_PROBE = "1"
await import("./document-export-lifecycle-probe")
