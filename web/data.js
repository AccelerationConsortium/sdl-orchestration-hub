/* Data transcribed from "Talking to instruments: device-integration standards for
   self-driving laboratories" (Gottstein, Pablo-García et al., draft dated 16 Sep 2026).
   Orchestrators: tools.js. Scenarios: Table 5. Scorecard: Tables 6-7 and the criteria text. */

/* Orchestrators live in tools.js (window.TOOLS). */

/* Table 4: standards comparison */
window.STANDARDS = {
  cols: ["SiLA 2", "OPC UA + LADS", "Typical vendor REST", "MCP (model-facing)"],
  rows: [
    ["Runtime discoverability", ["Yes", "Yes", "Limited", "Yes"]],
    ["Machine-readable semantics", ["Yes", "Yes", "Partial", "Partial"]],
    ["Strong typing & data model", ["Yes", "Yes", "Partial", "Yes"]],
    ["Runtime introspection (generic client)", ["Yes", "Yes", "Limited", "Yes"]],
    ["Composability & extension", ["Yes", "Yes", "Yes", "Yes"]]
  ],
  note: "Ratings reflect what each approach requires, not any particular implementation. A well-engineered REST + OpenAPI interface can satisfy most procurement criteria but still lacks a shared cross-vendor lab vocabulary. MCP and REST give typed I/O without one."
};

/* Table 5 and the scenario prose */
window.SCENARIOS = [
  { id: "frugal", stdCols: [], name: "Frugal / single-group academic SDL",
    profile: "One or two instruments, a small Python-fluent group, few cross-lab needs, no regulatory burden.",
    rec: "Python consumer/client layer (PyLabRobot, Opentrons), later a SiLA 2 wrapper",
    why: "Fastest path to a working prototype.",
    tradeoff: "These conventions are Python libraries, not network services: no discoverability across workstations or orchestrators. Keep device code behind a minimal typed interface (units, constraints, error objects) so wrapping it later as SiLA 2 or LADS is a refactor, not a rewrite. Keep the SiLA wrapper thin; labware and coordination state belong in the orchestrator.",
    pick: { instruments: "few", regulated: false, robotics: false, multisite: false } },
  { id: "shared", stdCols: [0], name: "Multi-instrument shared academic SDL",
    profile: "Several vendors, rotating users, moderate turnover, no hard regulatory deadlines.",
    rec: "SiLA 2",
    why: "Runtime discoverability, Python ecosystem, separation of concerns, flexibility for changing setups.",
    tradeoff: "A runtime-discoverable Feature catalog lets a client enumerate commands, parameters, properties and constraints without hand-written drivers (sila-python is the open reference implementation). It does not remove the need for device documentation, method knowledge, calibration state and safety context.",
    pick: { instruments: "many", regulated: false, robotics: false, multisite: false } },
  { id: "regulated", stdCols: [0, 1], name: "Regulated industrial / pharma",
    profile: "Audit trails, lifecycle management and enterprise integration matter.",
    rec: "SiLA 2 or OPC UA with LADS",
    why: "Audit, lifecycle, enterprise integration.",
    tradeoff: "If the same device is exposed over both, apply the scorecard to the endpoint your orchestrator will actually consume. Compliance on one endpoint does not transfer to the other. Regulated buyers may weigh the conformance-evidence criteria (C17) higher.",
    pick: { instruments: "many", regulated: true, robotics: false, multisite: false } },
  { id: "robotics", stdCols: [0, 1], name: "Robotics-heavy SDL",
    profile: "Arms, gantries or tracks tending many instruments inside a workcell.",
    rec: "ROS 2 or SiLA 2 for robots; SiLA 2 / LADS for instruments; under a shared orchestrator",
    why: "Separation of robot and instrument concerns.",
    tradeoff: "The cell-integration tier (C19–C21) is where every standard still leaves gaps for the integrator. Weigh C20/C21 higher for hazardous actuation and expect external sensors, interlocks or PLC-level safety.",
    pick: { instruments: "many", regulated: false, robotics: true, multisite: false } },
  { id: "multisite", stdCols: [], name: "Multi-site / cross-institutional",
    profile: "Experiments federated across laboratories.",
    rec: "Brokered federation (e.g. FINALES2) or a centralized integration platform, above local device-integration choices",
    why: "The cross-site layer is agnostic to local device-integration choices.",
    tradeoff: "Each site still needs a sound local device boundary; the criteria in the scorecard apply per instrument at each site.",
    pick: { instruments: "many", regulated: false, robotics: false, multisite: true } }
];

/* Cybersecurity / IT deliverables: unscored precondition for network-accessible endpoints */
window.CYBER = [
  "Port and protocol list",
  "Authentication and authorization model",
  "Transport-encryption posture (risk-acceptance procedure documented for explicitly isolated networks)",
  "Certificate and key lifecycle and rotation procedures",
  "Credential rotation and emergency-revocation processes",
  "Audit-log behaviour for control actions",
  "Vulnerability-disclosure channel",
  "Published security-update policy with target patch intervals",
  "Default-account policy",
  "Supported network-segmentation model"
];

/* Table 7. tier: C = Critical, I = Important, X = Cell-integration */
window.CRITERIA = [
  { n: 1, name: "Orchestrator-reachable programmatic control", tier: "C", w: 3,
    checks: "Network-reachable control with operation-correlated reconnect state and a documented, supported endpoint architecture.",
    hint: "Kill the client mid-command, reconnect, and determine whether the run completed, aborted or awaits clearance via a command/operation identifier. A human-readable status string alone does not pass. Accepted: native endpoint, or a vendor-supported edge controller with documented OS support window, watchdog behaviour, failure-mode table and instrument-side response if the controller fails." },
  { n: 2, name: "Strong typing with units and constraints", tier: "C", w: 3,
    checks: "Typed inputs and outputs; machine-readable units, constraints, precision and resolution; runtime validation and reported defaults.",
    hint: "Send an out-of-range value and an omitted parameter. Expect a typed error, or a default declared in the contract with the applied value reported back. Units must come from a declared vocabulary (UCUM, QUDT, SiLA FDL, OPC UA EUInformation/UNECE). Silent coercion or truncation fails." },
  { n: 3, name: "Structured error reporting", tier: "C", w: 3,
    checks: "Declared, retrievable typed errors with a message, structured context and a qualifying timestamp or event-sequence record.",
    hint: "Trigger a fault. Need a stable machine-readable identifier, human message, at least one structured context field (parameter, violated constraint, sensor channel) and a device-anchored timestamp or monotonic sequence ID. GUI dialogs, log-only diagnostics and silent failures fail." },
  { n: 4, name: "Open API access", tier: "C", w: 6,
    checks: "Included baseline autonomous API access; reusable and publishable buyer-written integrations; no baseline deployment royalties; documentation where required.",
    hint: "Read the contract. Is API access in the quoted package without capability gating or per-instrument integration fees? Can buyer-written integration code be published, reused and run under third-party orchestrators? Assessable by procurement without an engineer. Highest weight because it cannot be fixed by engineering after purchase." },
  { n: 5, name: "Control-accessible result retrieval", tier: "C", w: 3,
    checks: "Headless operation outcomes and applicable measurement results and metadata, unambiguously linked to execution.",
    hint: "Retrieve a measurement without the vendor GUI. Data must be typed, carry units, be correlatable to the operation, and come with operation status and quality flags. Encrypted proprietary formats readable only in vendor software fail." },
  { n: 6, name: "Runtime self-description", tier: "I", w: 2,
    checks: "Runtime capability introspection matching the deployed firmware, installed hardware and module configuration.",
    hint: "A generic client should enumerate the command surface with no prior knowledge. A served OpenAPI document meets the static capability sub-test but not state-aware availability." },
  { n: 7, name: "Observable command and property state", tier: "I", w: 2, floorNote: "C7",
    checks: "Concurrent non-blocking execution status and progress subscriptions, with recommended property and event subscriptions.",
    hint: "Start a long command; status queries must return without blocking and progress/phase must stream. Conditional floor: for hazardous actuation or shared-resource blocking (most HPLCs, incubators, NMRs, centrifuges) it must be at least Partial unless a documented external mitigation applies." },
  { n: 8, name: "Reference client implementation", tier: "I", w: 2,
    checks: "A usable source, generated-client or protocol-example path, with basic and representative workflow examples.",
    hint: "A working client library plus at least one non-trivial integration example representative of the instrument class." },
  { n: 9, name: "Concurrent-access discipline", tier: "I", w: 2,
    checks: "Atomic locking or documented single-controller exclusion, with ownership, lease and reconnect behaviour and gated clearing where provided.",
    hint: "Documented atomic lock acquisition, lock-state and ownership visibility, lease/reconnect behaviour, role-gated administrative clear. Persistent audit log is left to the integration layer." },
  { n: 10, name: "Machine-readable device and readiness state", tier: "I", w: 2,
    checks: "Named operational states and machine-readable recovery transitions, consistent with command-driven and internal activity.",
    hint: "Stable, named operational states with recovery transitions across commands, including states driven by internal activity (warm-up, self-test)." },
  { n: 11, name: "Result addressability and durability", tier: "I", w: 2,
    checks: "Stable, execution-linked results retrievable after restart; in-flight and interrupted-run results where applicable.",
    hint: "Restart client and instrument; the most recent result must remain retrievable by stable ID. Progressive outputs (kinetic reads, chromatograms) should be available incrementally." },
  { n: 12, name: "Instrument self-state", tier: "I", w: 2,
    checks: "Applicable calibration and qualification state, usage counters, device configuration and out-of-spec indications through the API.",
    hint: "Calibration status, qualification state, usage/maintenance counters (lamp hours, cycles, injections) and out-of-spec flags, readable on the same API as commands." },
  { n: 13, name: "Versioning discipline", tier: "I", w: 2,
    checks: "Version pinning, published versioning and deprecation policies, with deployment-appropriate support commitments.",
    hint: "Published versioning policy; a deployment can stay on a validated version; long-term support scaled to research vs regulated use." },
  { n: 14, name: "Simulation or emulation mode", tier: "I", w: 3,
    checks: "A drop-in simulator with configurable fault injection, monotonic event/progress reporting and access/motion-state fidelity.",
    hint: "Vendor-supplied virtual device exposing the same programmatic interface, able to be driven into failure states on demand, so recovery branches can be exercised before purchase." },
  { n: 15, name: "Control-loss observability and safe-state support", tier: "I", w: 3, floorNote: "C15",
    checks: "Control-session-loss detection and reporting; any optional non-safety-rated operational response remains configurable.",
    hint: "Drop the control session while hardware is active. Loss must be observable so the orchestrator can respond; any context-free safe default must be optional and overridable. Floor: unattended hazardous instruments must not Fail unless a documented external mechanism handles it." },
  { n: 16, name: "Error recovery taxonomy", tier: "I", w: 2,
    checks: "Fault transience, execution effect, post-error state and recovery class, with physical motion flagged where applicable.",
    hint: "Each error class carries four fields: transient vs permanent, execution-effect status, post-error device state, recovery class. Recovery actions that move the device are flagged." },
  { n: 17, name: "Conformance and certification", tier: "I", w: 2,
    checks: "Version-tied conformance evidence for both the communication protocol and the implemented device model.",
    hint: "Both base-protocol and device-semantics evidence. OPC UA certified without a documented LADS NodeSet, or SiLA 2 without a documented versioned Feature set, caps at Partial." },
  { n: 18, name: "Operating-system independence", tier: "I", w: 2,
    checks: "OS-neutral network access or open-server-OS bindings, with host dependencies and support windows disclosed.",
    hint: "Control path operable from a mainstream, automatable host. A stack tied to one proprietary desktop OS or to GUI automation is penalized." },
  { n: 19, name: "Automated load/unload", tier: "X", w: 2,
    checks: "Automated load/unload, documented handoff and collision geometry, plus a machine-readable readiness or completion indication.",
    hint: "Cell floor: at least Partial wherever a machine loads or unloads labware (readers, incubators, sealers, centrifuges, liquid handlers, stores, autosamplers). N/A for pumps, valves, chillers, sensors, cameras, fixed inline flow cells." },
  { n: 20, name: "Access and motion-readiness coordination", tier: "X", w: 2,
    checks: "Accurate, mutually consistent applicable access, motion and presence states, with a local robot-access indication where applicable.",
    hint: "Door/lid/shutter, axis position and motion, clamp/gripper and labware-presence states, and a robot-access state that reports clear only when all are arm-safe. Document how long an observation stays valid. These are automation primitives, not safety primitives." },
  { n: 21, name: "Safety-event participation", tier: "X", w: 2,
    checks: "Where applicable, latched hardware-stop reporting and clearance behaviour, plus timed orchestrator-issued operational shutdown.",
    hint: "No auto-resume after a hardware stop without explicit clearance; latched status on the normal channel; orchestrator shutdown command reaching a documented state in a documented interval. Labelling a non-certified signal as safety-rated is a Fail." }
];

/* "Implementation path for instrument vendors": what a vendor RFP response should include. */
window.EVIDENCE = [
  "Completed scorecard",
  "Interface documentation",
  "Versioning policy",
  "Authentication and authorization model",
  "Simulator or test endpoint",
  "Reference client",
  "Conformance artifacts (where applicable)",
  "Cybersecurity note",
  "Result-retrieval example",
  "Description of recovery behaviour after communication loss or process restart"
];
