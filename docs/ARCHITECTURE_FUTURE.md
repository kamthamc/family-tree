# Future Architecture: Local-First Considerations

## "True" Local-First with Syncing
Moving to a fully local-first architecture (where users can edit offline and sync later) would require a significant refactor of the current REST-based architecture.

### Complexity: High
1.  **Data Layer Replacement**:
    *   The current centralized `better-sqlite3` (or `bun:sqlite`) database on the server would need to be replaced by a client-side database (e.g., `sqlite-wasm`, `Pglite`, or `RxDB`).
    *   Authentication and permission logic moved to the client (with server-side verification).
2.  **Sync Engine**:
    *   A conflict-resolution system (CRDTs or Rebase-based) is needed.
    *   Potential tools: **PowerSync**, **Replicache**, or **ElectricSQL**.
3.  **Encryption Challenges**:
    *   Client-side encryption requires robust key management in the browser (`SubtleCrypto` + `IndexedDB`).
    *   Sharing keys between devices securely poses new UX challenges.

### Recommended Alternative: "Offline-Capable"
A more pragmatic approach for V2:
1.  **Read-Offline**: Cache API responses in `localStorage` (via React Query `persistQueryClient`).
2.  **Queue-Offline**: Store mutation requests (add/edit) in a queue and replay them when online.
