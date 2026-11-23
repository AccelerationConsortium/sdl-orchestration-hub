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
    hint: "From a machine that is not the vendor workstation, issue a command, sever and re-establish the network link mid-session, and determine whether the run completed, aborted or awaits clearance via a command/operation identifier. A human-readable status string alone does not pass. Accepted: native endpoint, or a vendor-supported edge controller with documented OS support window, watchdog behaviour, failure-mode table and instrument-side response if the controller fails." },
  { n: 2, name: "Strong typing with units and constraints", tier: "C", w: 3,
    checks: "Typed inputs and outputs; machine-readable units, constraints, precision and resolution; runtime validation and reported defaults.",
    hint: "Introspect a parameter and a return value that carry units: expect type, unit, range, precision/resolution and nullability/enum in the contract. Units must come from a declared vocabulary (UCUM, QUDT, SiLA FDL, OPC UA EUInformation/UNECE). Send an out-of-range value or invalid enum: expect a typed error; silent coercion or truncation is Partial. Omit a parameter that has a declared default: the applied value must be reported back. Send an unrecognized parameter: expect a typed error, not a silently substituted value." },
  { n: 3, name: "Structured error reporting", tier: "C", w: 3,
    checks: "Declared, retrievable typed errors with a message, structured context and a qualifying timestamp or event-sequence record.",
    hint: "Induce failures from at least two categories: an operational fault (missing sample, door open) and a command/constraint error (out-of-range input, invalid state). Each needs a stable machine-readable identifier, human message, at least one structured context field and a device-anchored timestamp or monotonic sequence ID. Errors must be declared in the contract and persisted. GUI dialogs, log-only diagnostics and silent failures fail." },
  { n: 4, name: "Open API access", tier: "C", w: 6,
    checks: "Included baseline autonomous API access; reusable and publishable buyer-written integrations; no baseline deployment royalties; documentation where required.",
    hint: "Read the contract. Is baseline API access in the quoted package without post-purchase gating? (Separately priced optional services that leave it intact are fine.) Can buyer-written integration code be published, reused and run under third-party orchestrators? Assessable by procurement without an engineer. Highest weight because it cannot be fixed by engineering after purchase." },
  { n: 5, name: "Control-accessible result retrieval", tier: "C", w: 3,
    checks: "Headless operation outcomes and applicable measurement results and metadata, unambiguously linked to execution.",
    hint: "Retrieve a representative result from a non-vendor host with headless, licence-compliant tooling. The payload and its metadata (IDs, status, units, timestamps, quality flags) must be bound to the execution ID, inline or via separate properties. Encrypted proprietary formats readable only in vendor software fail." },
  { n: 6, name: "Runtime self-description", tier: "I", w: 2,
    checks: "Runtime capability introspection matching the deployed firmware, installed hardware and module configuration.",
    hint: "A generic client should enumerate the command surface with no prior knowledge. A served OpenAPI document can pass capability introspection (a), and also state-aware availability (b) if it is scoped to the unit’s actual module configuration." },
  { n: 7, name: "Observable command and property state", tier: "I", w: 2, floorNote: "C7",
    checks: "Concurrent non-blocking execution status and progress subscriptions, with recommended property and event subscriptions.",
    hint: "Start a long command; status queries must return without blocking and progress/phase must stream. Conditional floor: for hazardous actuation or shared-resource blocking (most HPLCs, incubators, NMRs, centrifuges) it must score at least Partial." },
  { n: 8, name: "Reference client implementation", tier: "I", w: 2,
    checks: "A usable source, generated-client or protocol-example path, with basic and representative workflow examples.",
    hint: "A working client library plus at least one non-trivial integration example representative of the instrument class." },
  { n: 9, name: "Concurrent-access discipline", tier: "I", w: 2,
    checks: "Atomic locking or documented single-controller exclusion, with ownership, lease and reconnect behavior and gated clearing where provided.",
    hint: "Documented atomic lock acquisition, lock-state and ownership visibility, lease/reconnect behaviour, role-gated administrative clear. Persistent audit log is left to the integration layer." },
  { n: 10, name: "Machine-readable device and readiness state", tier: "I", w: 2,
    checks: "Named operational states and machine-readable recovery transitions, consistent with command-driven and internal activity.",
    hint: "Read the state after cold boot, initialization, a long operation and an induced failure; each must be a fixed state code. A busy state must match a command in progress or a distinguishable internal activity (warm-up, self-calibration, maintenance), not idle whenever no external command runs. Recovery transitions must be machine-readable; a PDF-only table does not pass." },
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
    hint: "Drop the control session during a long-running operation. The instrument must detect the loss within the configured interval and expose a control-session-lost status through the API (on reconnect or through a side channel). A safe default is optional; if the vendor offers one, the orchestrator must be able to enable and disable it. Reconnect behavior is graded under C1. Floor: unattended hazardous instruments must not Fail unless a documented external mechanism (cell watchdog, interlock, power cutoff, orchestrator) handles it." },
  { n: 16, name: "Error recovery taxonomy", tier: "I", w: 2,
    checks: "Fault transience, execution effect, post-error state and recovery class, with physical motion flagged where applicable.",
    hint: "Each error class carries four fields: transient vs permanent, execution-effect status, post-error device state, recovery class. Induce a transient, a hard fault and a mid-operation fault, plus one per other published category. Where a recovery action moves the device, it must be flagged as involving physical motion." },
  { n: 17, name: "Conformance and certification", tier: "I", w: 2,
    checks: "Version-tied conformance evidence for both the communication protocol and the implemented device model.",
    hint: "Both base-protocol and device-semantics evidence. OPC UA certified without a documented LADS NodeSet, or SiLA 2 without a documented versioned Feature set, caps at Partial." },
  { n: 18, name: "Operating-system independence", tier: "I", w: 2,
    checks: "OS-neutral network access or open-server-OS bindings, with host dependencies and support windows disclosed.",
    hint: "Control path operable from a mainstream, automatable host. A stack tied to one proprietary desktop OS or to GUI automation is penalized." },
  { n: 19, name: "Automated load/unload", tier: "X", w: 2,
    checks: "Automated load/unload, documented handoff and collision geometry, plus a machine-readable readiness or completion indication.",
    hint: "Cell floor: at least Partial wherever a machine loads or unloads labware (readers, incubators, sealers, centrifuges, liquid handlers, stores, autosamplers). A Fail disqualifies from cell deployment. N/A for instruments that do not receive machine-loaded labware (inline pumps, flow cells, fixed sensors)." },
  { n: 20, name: "Access and motion-readiness coordination", tier: "X", w: 2,
    checks: "Accurate, mutually consistent applicable access, motion and presence states, with a local robot-access indication where applicable.",
    hint: "Door/lid/shutter, axis position and motion, clamp/gripper and labware-presence states, and a robot-access state that reports clear only when all are arm-safe. The vendor declares which categories apply; undeclared means all apply. Documenting latency is optional. These are automation primitives, not safety primitives." },
  { n: 21, name: "Safety-event participation", tier: "X", w: 2,
    checks: "Where applicable, latched hardware-stop reporting and clearance behavior, plus timed orchestrator-issued operational shutdown.",
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

/* The paper's five-layer model (Table 1, Fig. 2), top to bottom, with where each layer is
   covered on this site. MCP is a peer interface spanning layers 4 and 3, not a layer above. */
window.STACK = [
  { n: 5, name: "Orchestration", does: "Composes device operations into experiments and workflows: scheduling, labware state, recovery, audit.",
    examples: "ChemOS 2.0, Bluesky, MADSci, AlabOS …", scope: "Surveyed", links: [["#orchestrators", "Orchestrators"]] },
  { n: 4, name: "Information exchange", does: "Defines what messages carry: typed commands, properties, state, events and errors in a domain vocabulary.",
    examples: "SiLA 2, OPC UA + LADS, REST + OpenAPI, MCP tool contracts", scope: "Primary focus", focus: true, links: [["#standards", "Standards"], ["#scorecard", "Scorecard"], ["#tutorials", "Tutorials"]] },
  { n: 3, name: "Consumer / client", does: "A client on one host that turns workflow intent into concrete device calls.",
    examples: "SiLA / OPC UA clients, vendor SDKs, PyLabRobot backends, connectors", scope: "Secondary focus", links: [["#tutorials", "Tutorials"]] },
  { n: 2, name: "Communication protocol", does: "Message framing, addressing and request/response semantics.",
    examples: "gRPC, HTTP, Modbus, OPC UA binary", scope: "Precondition" },
  { n: 1, name: "Transport", does: "Moves bytes between two endpoints.",
    examples: "USB, RS-232/485, Ethernet, TCP/IP", scope: "Precondition" }
];

/* Instrument groups, from the paper's scope statement. `id` is what devices/*.yml stores in
   device.group; `types` and `tasks` are suggestions for the scorecard form and the finder. */
window.INSTRUMENT_GROUPS = [
  { id: "measurement", name: "Measurement and analysis", examples: "plate readers, HPLCs, spectrometers",
    types: ["Plate reader", "HPLC / UHPLC", "Gas chromatograph", "Mass spectrometer", "NMR spectrometer", "Spectrometer (UV-Vis, IR, Raman)", "Microscope / imager", "Flow cytometer", "Sequencer", "Electrochemical workstation"],
    tasks: ["absorbance", "fluorescence", "luminescence", "chromatography", "mass spectrometry", "NMR", "spectroscopy", "imaging", "electrochemistry", "cell analysis"] },
  { id: "reaction", name: "Reaction hardware", examples: "batch and flow reactors",
    types: ["Batch reactor", "Flow reactor", "Photoreactor", "Parallel synthesizer"],
    tasks: ["synthesis", "flow chemistry", "photochemistry", "heating / cooling"] },
  { id: "sample-handling", name: "Sample handling and preparation", examples: "liquid handlers, sealers, heater-shakers, centrifuges, autosamplers",
    types: ["Liquid handler", "Dispenser", "Plate sealer / peeler", "Heater-shaker", "Centrifuge", "Incubator", "Autosampler", "Automated store / plate hotel"],
    tasks: ["liquid transfer", "dispensing", "sealing", "mixing / shaking", "centrifugation", "incubation", "sample injection", "storage"] },
  { id: "process-control", name: "Process sensing and control", examples: "balances, sensors, pumps, valves, flow controllers, cameras",
    types: ["Balance", "pH / conductivity meter", "Temperature / pressure sensor", "Pump", "Valve", "Flow sensor / controller", "Chiller / thermostat", "Camera / vision sensor", "Barcode / RFID reader"],
    tasks: ["weighing", "pH measurement", "temperature control", "pressure control", "pumping", "flow control", "visual inspection", "sample tracking"] },
  { id: "labware-robot", name: "Labware-moving robots", examples: "plate movers, robot arms, mobile manipulators",
    types: ["Plate mover / robot arm", "Mobile manipulator", "Gantry / track"],
    tasks: ["labware transport", "pick and place"] }
];

/* Control interfaces an evaluation can name (the endpoint scored, and others offered). */
window.INTERFACES = ["SiLA 2", "OPC UA + LADS", "REST + OpenAPI", "MCP", "Vendor SDK", "Other"];

/* Instrument finder: plain-language requirement for each criterion, and presets built from the
   paper's guidance (conditional floors, cell-integration floors, regulated use). */
window.REQ_LABELS = {
  1: "Controllable over the network from the orchestrator", 2: "Typed parameters with units and limits", 3: "Machine-readable errors",
  4: "API access included; integration code reusable", 5: "Results retrievable without the vendor GUI", 6: "Describes its own capabilities at runtime",
  7: "Reports progress and state while running", 8: "Ships a working reference client", 9: "Safe locking when several clients connect",
  10: "Reports idle / busy / error states", 11: "Results survive restarts and are addressable", 12: "Reports calibration and maintenance state",
  13: "Versioned API with deprecation policy", 14: "Simulator for testing before purchase", 15: "Detects lost control and supports a safe state",
  16: "Classifies errors for automatic recovery", 17: "Conformance or certification evidence", 18: "Works from any operating system",
  19: "A robot can load and unload it", 20: "Tells a robot when it is safe to reach in", 21: "Reports hardware safety stops"
};
window.REQ_PRESETS = [
  { id: "unattended", name: "Unattended, hazardous operation", why: "The C7 and C15 conditional floors, plus C21 for hazardous motion.", req: { 7: "P", 15: "P", 21: "P" } },
  { id: "workcell", name: "Robotic workcell", why: "Cell-integration floor (C19) and the C20/C21 local floors.", req: { 19: "P", 20: "P", 21: "P" }, cell: true },
  { id: "offline-dev", name: "Develop before the instrument arrives", why: "A simulator and a reference client let you build the integration first.", req: { 8: "G", 14: "G" } },
  { id: "regulated", name: "Regulated or validated lab", why: "Version pinning, conformance evidence and self-state for qualification.", req: { 12: "P", 13: "G", 17: "G" } }
];

/* Tutorials: resources from the 2026 Device Integration Hackathon
   (https://sites.google.com/view/deviceintegrationhackathon/home/links-and-resources). */
window.TUTORIALS = {
  source: { name: "Device Integration Hackathon 2026", url: "https://sites.google.com/view/deviceintegrationhackathon/home", resources: "https://sites.google.com/view/deviceintegrationhackathon/home/links-and-resources", contact: "willi.gottstein@utoronto.ca" },
  path: [
    { step: "Set up", title: "Prepare your computer", items: [
      { title: "Installation guide", url: "https://docs.unitelabs.io/connector-development/getting-started/installation/#prerequisites", kind: "Docs", by: "UniteLabs", desc: "Setup steps for building connectors with the Connector Development Kit (CDK)." },
      { title: "Hardware requirements and a complete minimal example", url: "https://docs.google.com/document/d/1TVBsz6kFL6aHarG8sddsYICyvp7qM-5MikkWJVkFVhQ/edit?usp=sharing", kind: "Google Doc", by: "Hackathon", desc: "The hardware you need, plus a fully worked minimal example." }
    ] },
    { step: "Learn", title: "Learn SiLA 2 and the CDK", items: [
      { title: "Connector Development Kit documentation", url: "https://docs.unitelabs.io/connector-development/", kind: "Docs", by: "UniteLabs", desc: "A tutorial on SiLA basics and writing SiLA servers with the CDK, plus guides on configuration and error handling." },
      { title: "Tutorial connector", url: "https://gitlab.com/unitelabs/examples/tutorial", kind: "Code (GitLab)", by: "UniteLabs", desc: "A pre-written connector with all of the documentation's example code, for working through the tutorial interactively." },
      { title: "From manual to SiLA server (slides)", url: "https://docs.google.com/presentation/d/1ym9iJ2CFji4BOO8w0RxeLiL7oA1wouZbJY7tP0LjVQQ/edit?usp=sharing", kind: "Slides", by: "Hackathon", desc: "A practical guide to building a SiLA server with the Python CDK. The deep dive is in hidden slides for reference." }
    ] },
    { step: "Design", title: "Turn instrument documentation into SiLA Features", items: [
      { title: "Intro to the SiLA Feature Generator (slides)", url: "https://drive.google.com/file/d/1YpGhqRno8xzIolZ0NM_3KmTyKgBmDnOh/view?usp=drive_link", kind: "Slides", by: "Hackathon", desc: "How to turn instrument documentation into downloadable SiLA 2 Feature XML definitions." },
      { title: "SiLA Feature XML Generator", url: "https://sila-feature-gen.pages.dev/", kind: "Tool", by: "Hackathon", desc: "Extracts and designs Feature XMLs from device documentation.", note: "Registered participants only.", extra: { title: "Registration form", url: "https://airtable.com/appYBjHgttvBuz3XR/paga3fOK3rkLzXhYc/form" } }
    ] },
    { step: "Build", title: "Start your own connector", items: [
      { title: "Connector Factory project template", url: "https://gitlab.com/unitelabs/cdk/connector-factory", kind: "Code (GitLab)", by: "UniteLabs", desc: "Boilerplate for starting a Python connector application." },
      { title: "Hackathon code repository", url: "https://gitlab.com/unitelabs/events/device-integration-hackathon-2026", kind: "Code (GitLab)", by: "Hackathon", desc: "Additional coding resources from the hackathon, for public use." }
    ] }
  ],
  /* Paper-grounded advice for anyone writing a driver or connector (Scenario-driven guidance and C-criteria rationale). */
  tips: [
    ["Type it from day one", "Even in a frugal setup, put device code behind a minimal typed interface with units, constraints and error objects, so wrapping it later as a SiLA 2 or LADS service is a refactor, not a rewrite."],
    ["Keep the wrapper thin", "A connector exposes the instrument. Labware state, scheduling and coordination belong in the orchestrator."],
    ["Never block the event loop", "Call blocking vendor SDKs, serial ports or COM/.NET code from worker threads or processes."],
    ["Map command lifecycles", "Bridge Started / Running / Finished / Cancelled into the orchestrator's state machine so progress and recovery stay observable (C7, C10)."],
    ["Errors are data", "Return structured errors with a stable identifier and context (C3, C16). The same holds for MCP servers: define types, units and output schemas deliberately."],
    ["Ship a simulator", "A drop-in simulator with fault injection lets others build and test against your connector before touching hardware (C14)."]
  ],
  /* Routes the learning path does not cover: other SiLA 2 implementations, OPC UA LADS, and other approaches. */
  others: [
    { title: "SiLA 2 with other implementations", desc: "The same standard without the UniteLabs CDK.", links: [
      { title: "sila2 (Python)", url: "https://sila2.gitlab.io/sila_python", desc: "The SiLA Consortium's own Python implementation, installed with pip install sila2." },
      { title: "sila_csharp (.NET)", url: "https://gitlab.com/SiLA2/sila_csharp", desc: "The SiLA Consortium's C# implementation." },
      { title: "All SiLA 2 open-source implementations", url: "https://gitlab.com/SiLA2", desc: "The SiLA Consortium's GitLab group, with implementations in several languages." }
    ] },
    { title: "OPC UA LADS", desc: "An alternative standard: the OPC UA companion specification for laboratory and analytical devices (OPC 30500).", links: [
      { title: "LADS community on GitHub", url: "https://github.com/opcua-lads", desc: "A suggested learning path with introductory videos, recorded talks and examples." },
      { title: "LADS workshop", url: "https://github.com/opcua-lads/workshop", desc: "A sample luminescence-reader server in Node.js/TypeScript, with slides." },
      { title: "Simulated LADS servers", url: "https://github.com/opcua-lads/lads-server-collection", desc: "Viscometer, pH meter, freezer and balance servers to build and test against." },
      { title: "lads-client-py", url: "https://github.com/opcua-lads/lads-client-py", desc: "A Python client library with a Streamlit viewer." },
      { title: "The specification", url: "https://reference.opcfoundation.org/LADS/v100/docs/", desc: "OPC 30500-1, free to read online." }
    ] },
    { title: "Other approaches and test clients", desc: "Without a device-integration standard, or for model-facing interfaces.", links: [
      { title: "PyLabRobot", url: "https://github.com/PyLabRobot/pylabrobot", desc: "Hardware-agnostic Python interface for liquid handlers and accessories, with a browser simulator." },
      { title: "MCP Inspector", url: "https://github.com/modelcontextprotocol/inspector", desc: "Generic client for testing Model Context Protocol servers." }
    ] }
  ]
};
