# Anonymized (paper Case A) — Reader X

> **Generated** by `build/score_device.py` from `devices/*.yml`. Do not edit by hand.
> Grades are a contributor assessment, not an endorsement.

Interface: SiLA 2 · C1 architecture: Native endpoint · Category: fluorescence plate reader · Group: Measurement and analysis · Tasks: fluorescence · Interfaces offered: SiLA 2 · Deployment: cell-integrated · Evidence: hands-on-test · Evaluator: paper worked example · Date: 2026-01-01 · Scorecard version: 1.0.0 · Verified: no

- **Standalone total (C1–C18):** 36 / 46
- **Cell-integrated total (C1–C21):** 39 / 52
- **Floors:** Critical floor ✓, Important floor ✓, Cell-integration floor ✓ → eligible (totals rank eligible devices; floors decide eligibility)

| # | Criterion | Tier | Weight | Grade | Notes |
|---|---|---|---|---|---|
| C1 | Orchestrator-reachable programmatic control | Critical | 3 | Partial | native SiLA 2 server; reconnect documented only as "best-effort"; reconnect mode and operation-identifier mechanism must be specified explicitly (remediation required before contract) |
| C2 | Strong typing with units and constraints | Critical | 3 | Pass | typed parameters; units from declared vocabulary; FDL constraints machine-readable and enforced (out-of-range value rejected with a typed error) |
| C3 | Structured error reporting | Critical | 3 | Pass | SiLA 2 defined errors with stable ID, human-readable message, structured context field, device-anchored timestamp, declared FDL error catalog and errors retrievable after delivery |
| C4 | Open API access | Critical | 6 | Pass | no paywall; ecosystem-use license; publication and reuse of buyer-written integration code permitted |
| C5 | Control-accessible result retrieval | Critical | 3 | Pass | headless API retrieves result by execution ID; HDF5 payload readable without vendor software and includes required metadata |
| C6 | Runtime self-description | Important | 2 | Partial | FDL exposes capability introspection (sub-test a); operations not scoped to the deployed module configuration (compulsory sub-test b absent; transient state gating is a SHOULD and not the basis for this grade) |
| C7 | Observable command and property state | Important | 2 | Pass | kinetic acquisition observable; concurrent status query returns within documented interval |
| C8 | Reference client implementation | Important | 2 | Pass | hello world example plus kinetic-series worked example |
| C9 | Concurrent-access discipline | Important | 2 | Partial | LockController exposes lock state; ownership reporting, preemption path, and hierarchical per-unit locks not documented |
| C10 | Machine-readable device and readiness state | Important | 2 | Pass | named operational states with documented recovery transitions in machine-readable form |
| C11 | Result addressability and durability | Important | 2 | Partial | stable result identifiers; no in-flight access to increments during the run |
| C12 | Instrument self-state | Important | 2 | Fail | calibration, qualification, and usage state not exposed through API (remediation commitment required before contract; the Fail clears only once the capability is exposed and its acceptance test passes) |
| C13 | Versioning discipline | Important | 2 | Pass | semver plus deprecation notices; research-only deployment context; regulated-deployment bar not evaluated |
| C14 | Simulation or emulation mode | Important | 3 | Partial | drop-in simulator that can be driven to fail on invalid inputs and command sequences, but without configurable failure injection |
| C15 | Control-loss observability and safe-state support | Important | 3 | Pass | exposes control-session-lost status with a configurable, overridable vendor-declared safe default |
| C16 | Error recovery taxonomy | Important | 2 | Fail | no recovery taxonomy beyond basic error identifier and message (remediation commitment required before contract; the Fail clears only once the capability is exposed and its acceptance test passes) |
| C17 | Conformance and certification | Important | 2 | Pass | SiLA 2 self-certification with complete published test evidence and a versioned Feature set for the shipped instrument |
| C18 | Operating-system independence | Important | 2 | Pass | native SiLA 2 network service, reachable from any client OS; no single-operating-system dependency in the client path |
| C19 | Automated load/unload | Cell-integration | 2 | Partial | motorized plate carrier supports automated load and unload, but the API exposes no explicit handoff-ready or load-complete signal; remediation commitment required before unmanned workcell operation |
| C20 | Access and motion-readiness coordination | Cell-integration | 2 | Partial | door state and axis motion state exposed; vendor does not declare a robot-access state |
| C21 | Safety-event participation | Cell-integration | 2 | Partial | orchestrator-issued shutdown (sub-test b) supported; hardware safety-event reporting (sub-test a) absent; remediation commitment required before unmanned workcell operation |

