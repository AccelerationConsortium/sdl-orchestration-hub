# Anonymized (paper Case A) — Reader X

> **Generated** by `build/score_device.py` from `devices/*.yml`. Do not edit by hand.
> Grades are a contributor assessment, not an endorsement.

Interface: SiLA 2 · C1 architecture: Native endpoint · Category: fluorescence plate reader · Deployment: cell-integrated · Evidence: hands-on-test · Evaluator: paper worked example · Date: 2026-01-01 · Scorecard version: 1.0.0 · Verified: no

- **Standalone total (C1–C18):** 36 / 46
- **Cell-integrated total (C1–C21):** 39 / 52
- **Floors:** Critical floor ✓, Important floor ✓, Cell-integration floor ✓ → eligible (totals rank eligible devices; floors decide eligibility)

| # | Criterion | Tier | Weight | Grade | Notes |
|---|---|---|---|---|---|
| C1 | Orchestrator-reachable programmatic control | Critical | 3 | Partial | native SiLA 2 server; reconnect documented only as best-effort |
| C2 | Strong typing with units and constraints | Critical | 3 | Pass | typed params; FDL constraints enforced |
| C3 | Structured error reporting | Critical | 3 | Pass | SiLA 2 defined errors with stable id, message, structured context |
| C4 | Open API access | Critical | 6 | Pass | no paywall; ecosystem-use license; code reuse permitted |
| C5 | Control-accessible result retrieval | Critical | 3 | Pass | headless retrieval by execution id; HDF5 readable without vendor software |
| C6 | Runtime self-description | Important | 2 | Partial | capability introspection present; not gated to deployed config/state |
| C7 | Observable command and property state | Important | 2 | Pass | kinetic acquisition observable; status query within documented interval |
| C8 | Reference client implementation provided | Important | 2 | Pass | hello-world plus kinetic-series worked example |
| C9 | Concurrent-access discipline | Important | 2 | Partial | lock state exposed; ownership/preemption/per-unit locks undocumented |
| C10 | Machine-readable device and readiness state | Important | 2 | Pass | named states with documented recovery transitions |
| C11 | Result addressability and durability | Important | 2 | Partial | stable result ids; no in-flight access to increments |
| C12 | Instrument self-state | Important | 2 | Fail | calibration/qualification/usage state not exposed via API |
| C13 | Versioning discipline | Important | 2 | Pass | semver plus deprecation notices (research context) |
| C14 | Simulation or emulation mode | Important | 3 | Partial | simulator present but no configurable failure injection |
| C15 | Control-loss observability and safe-state support | Important | 3 | Pass | control-session-lost status with configurable safe default |
| C16 | Error recovery taxonomy | Important | 2 | Fail | no recovery taxonomy beyond basic error id and message |
| C17 | Conformance and certification | Important | 2 | Pass | SiLA 2 self-certification with published test evidence |
| C18 | Operating-system independence | Important | 2 | Pass | native SiLA 2 network service; OS-neutral, reachable from any client OS |
| C19 | Automated load/unload | Cell-integration | 2 | Partial | motorized carrier loads/unloads; no explicit handoff-ready signal |
| C20 | Access and motion-readiness coordination | Cell-integration | 2 | Partial | door/axis state exposed; no declared robot-access state |
| C21 | Safety-event participation | Cell-integration | 2 | Partial | orchestrator-issued shutdown supported; hardware safety-event reporting absent |

