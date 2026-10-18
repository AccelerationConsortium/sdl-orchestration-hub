/* Orchestrator registry.
   One object per tool. Table 2 of the manuscript supplies mech / standards / notes / license;
   location, links and logo were looked up separately (see README → "Adding a tool").
   To add a tool, append an object with the same keys. Only `id`, `name`, `org`, `lat`, `lng`,
   `family` are required; everything else may be omitted or left "".

   family:   "formal"  consumes a formally governed information-exchange standard (even if optional)
             "hal"     hardware-abstraction layer over facility control systems
             "agentic" model-facing protocol (MCP)
             "bespoke" own Python class hierarchy / plugin system
   logo:     any image URL; GitHub org avatars (https://github.com/<org>.png) work well.
   verified: set false on any field you have not confirmed; the UI flags it.            */

window.TOOLS = [
  { id: "alabos", name: "AlabOS", ref: "31", paper: "https://doi.org/10.1039/D4DD00129J",
    org: "Ceder Group, Lawrence Berkeley National Laboratory / UC Berkeley", city: "Berkeley, CA", country: "USA", lat: 37.8755, lng: -122.2530,
    website: "https://github.com/CederGroupHub/alabos", repo: "https://github.com/CederGroupHub/alabos", docs: "https://cedergrouphub.github.io/alabos/", logo: "https://github.com/CederGroupHub.png?size=96",
    family: "bespoke", mech: "Custom BaseDevice abstract base class", standards: [],
    notes: "Example devices wrap XML-RPC and HTTP inside the device class.", license: "MIT", verified: true },

  { id: "ares", name: "ARES OS 2.0", ref: "32", paper: "https://arxiv.org/abs/2604.03440",
    org: "Air Force Research Laboratory, Materials and Manufacturing Directorate", city: "Wright-Patterson AFB, Dayton, OH", country: "USA", lat: 39.8266, lng: -84.0486,
    website: "https://afrl-ares.github.io", repo: "https://github.com/AFRL-ARES/ARES", docs: "https://afrl-ares.github.io", logo: "https://github.com/AFRL-ARES.png?size=96",
    family: "bespoke", mech: "Custom plugin architecture (Devices, Analysis, Planning plugins over gRPC/Protobuf; PyAres for Python modules)", standards: [],
    notes: "Devices, Analysis and Planning plugin pattern. C#/.NET core with Blazor front end; PyAres wraps the gRPC/Protobuf API for Python devices and planners.", license: "USAF Open Source Agreement 1.0", verified: true },

  { id: "bluesky", name: "Bluesky + Ophyd", ref: "33", paper: "https://doi.org/10.1080/08940886.2019.1608121",
    org: "NSLS-II, Brookhaven National Laboratory", city: "Upton, NY", country: "USA", lat: 40.8687, lng: -72.8786,
    website: "https://blueskyproject.io", repo: "https://github.com/bluesky/bluesky", docs: "https://blueskyproject.io", logo: "https://github.com/bluesky.png?size=96",
    family: "hal", mech: "Ophyd hardware-abstraction layer; Bluesky itself is protocol-agnostic", standards: ["EPICS", "Tango", "SCPI", "yaq"],
    notes: "Reference deployment at NSLS-II uses EPICS via pyepics (the most common backend); Tango, SCPI and yaq via Ophyd sub-packages. Bluesky documentation disclaims direct hardware support.", license: "BSD-3-Clause", verified: true },

  { id: "chemios", name: "Chemios", ref: "34", paper: "https://github.com/Chemios/chemios",
    org: "Chemios contributors (K. Felton)", city: "Raleigh, NC", country: "USA", lat: 35.7847, lng: -78.6821,
    website: "https://chemios.readthedocs.io", repo: "https://github.com/Chemios/chemios", docs: "https://chemios.readthedocs.io", logo: "https://github.com/Chemios.png?size=96",
    family: "bespoke", mech: "Custom pump and instrument classes", standards: [],
    notes: "pyserial and minimalmodbus for direct hardware access. Pumps, spectrometers and temperature controllers; last repository activity 2021.", license: "MIT",
    verified: false, unverified: "Home institution and location inferred from the lead contributor; not confirmed by the project." },

  { id: "chemos2", name: "ChemOS 2.0", ref: "35", paper: "https://doi.org/10.1016/j.matt.2024.04.022",
    org: "Aspuru-Guzik Group, University of Toronto / Acceleration Consortium", city: "Toronto, ON", country: "Canada", lat: 43.6600, lng: -79.3957,
    website: "https://acceleration.utoronto.ca", repo: "https://github.com/malcolmsimgithub/ChemOS2.0", docs: "", logo: "https://github.com/aspuru-guzik-group.png?size=96",
    family: "formal", enforced: true, mech: "SiLA 2 (required for all device drivers)", standards: ["SiLA 2"],
    notes: "All servers and clients are built on the sila2 bindings; no alternative integration path.", license: "MIT", verified: true },

  { id: "eos", name: "EOS", ref: "36", paper: "https://doi.org/10.1109/ICRA55743.2025.11128578",
    org: "UNC Robotics, University of North Carolina at Chapel Hill", city: "Chapel Hill, NC", country: "USA", lat: 35.9049, lng: -79.0469,
    website: "https://unc-robotics.github.io/eos/", repo: "https://github.com/UNC-Robotics/eos", docs: "https://unc-robotics.github.io/eos/", logo: "https://github.com/UNC-Robotics.png?size=96",
    family: "formal", optional: true, mech: "Custom BaseDevice abstraction plus plugin system", standards: ["SiLA 2 (optional)"],
    notes: "SilaDeviceMixin and an optional sila2 dependency group; the primary path remains the custom plugin model.", license: "BSD-3-Clause", verified: true },

  { id: "helao", name: "HELAO-async", ref: "37", paper: "https://doi.org/10.1002/admi.202101987",
    org: "High-Throughput Experimentation group (Gregoire), Caltech; with KIT / Helmholtz Institute Ulm", city: "Pasadena, CA", country: "USA", lat: 34.1377, lng: -118.1253,
    website: "https://github.com/High-Throughput-Experimentation/helao-async", repo: "https://github.com/High-Throughput-Experimentation/helao-async", docs: "", logo: "https://github.com/High-Throughput-Experimentation.png?size=96",
    family: "formal", optional: true, mech: "Custom HelaoDriver abstract base class", standards: ["OPC UA (declared dependency)", "Modbus (declared dependency)"],
    notes: "asyncua and pymodbus are declared dependencies; shipped drivers use vendor-specific protocols (Biologic, Gamry, Galil).", license: "MIT", verified: true },

  { id: "ivoryos", name: "IvoryOS", ref: "38", paper: "https://doi.org/10.1038/s41467-025-60514-w",
    org: "Hein Group, University of British Columbia", city: "Vancouver, BC", country: "Canada", lat: 49.2606, lng: -123.2460,
    website: "https://ivoryos.ai", repo: "https://github.com/ivoryos-ai/IvoryOS", docs: "https://ivoryos.readthedocs.io", logo: "https://github.com/ivoryos-ai.png?size=96",
    family: "bespoke", mech: "Dynamic function introspection (Flask)", standards: [],
    notes: "Standard-agnostic by design: exposes any Python module via a dynamically generated web interface.", license: "MIT", verified: true },

  { id: "madsci", name: "MADSci", ref: "39", paper: "https://doi.org/10.21105/joss.09416",
    org: "Argonne National Laboratory, Data Science and Learning Division", city: "Lemont, IL", country: "USA", lat: 41.7183, lng: -87.9784,
    website: "https://ad-sdl.github.io/MADSci/", repo: "https://github.com/AD-SDL/MADSci", docs: "https://ad-sdl.github.io/MADSci/", logo: "https://github.com/AD-SDL.png?size=96",
    family: "formal", optional: true, mech: "Custom AbstractNode / RestNode module over REST", standards: ["SiLA 2 (optional)"],
    notes: "REST node modules wrap vendor protocols; ships a generated SiLA 2 example node and declares sila2 as an optional dependency.", license: "MIT", verified: true },

  { id: "minerva", name: "MINERVA-OS", ref: "22", paper: "https://doi.org/10.1021/acsnano.4c17504",
    org: "Federal Institute for Materials Research and Testing (BAM), Division 6.7", city: "Berlin", country: "Germany", lat: 52.4300, lng: 13.5300,
    website: "https://www.bam.de", repo: "", docs: "", logo: "https://github.com/BAMresearch.png?size=96",
    family: "bespoke", mech: "Custom ABC hierarchy", standards: [],
    notes: "pyserial and pythonnet for proprietary instruments. Components published with the ACS Nano paper and its SI.", license: "MIT",
    verified: false, unverified: "No public repository located; the project describes all components as publicly available." },

  { id: "nimo", name: "NIMO", ref: "40–43", paper: "https://arxiv.org/abs/2605.15227",
    org: "National Institute for Materials Science (NIMS), Center for Basic Research on Materials", city: "Tsukuba", country: "Japan", lat: 36.0660, lng: 140.1300,
    website: "https://github.com/NIMS-DA/nimo", repo: "https://github.com/NIMS-DA/nimo", docs: "", logo: "https://github.com/NIMS-DA.png?size=96",
    family: "agentic", mech: "MCP (model-facing, agentic)", standards: ["MCP"],
    notes: "Device integration is provided by the NIMO Controller; MCP connects a language-model agent to the decision engine and to laboratory devices. MCP is a model-facing natural-language interface, not a formally governed type system.", license: "MIT", verified: true },

  { id: "ochra", name: "OChRA", ref: "44", paper: "https://github.com/OChRA-lab/ochra",
    org: "OChRA team (Open Chemistry Robotics and Automation)", city: "Liverpool", country: "UK", lat: 53.4060, lng: -2.9660,
    website: "https://ochra-lab.github.io/ochra/", repo: "https://github.com/OChRA-lab/ochra", docs: "https://ochra-lab.github.io/ochra/", logo: "https://github.com/OChRA-lab.png?size=96",
    family: "bespoke", mech: "Custom station/device adapters over REST (pydantic models)", standards: [],
    notes: "Layered lab and per-station FastAPI servers; device operations dispatched by method name; MongoDB persistence; early-stage prototype (v0.0.1).", license: "MIT",
    verified: false, unverified: "The project publishes no affiliation; location placed at the host of its 2025 AIchemy workshop." },

  { id: "octopus", name: "OCTOPUS", ref: "45", paper: "https://doi.org/10.1038/s41467-024-54067-7",
    org: "Korea Institute of Science and Technology (KIST), Computational Science Research Center", city: "Seoul", country: "Republic of Korea", lat: 37.6010, lng: 127.0460,
    website: "https://github.com/KIST-CSRC/Octopus", repo: "https://github.com/KIST-CSRC/Octopus", docs: "", logo: "https://github.com/KIST-CSRC.png?size=96",
    family: "bespoke", mech: "Custom resource-allocation and scheduling framework", standards: [],
    notes: "JSON job scripts; aiohttp transport between master and module nodes.", license: "Not specified", verified: true },

  { id: "place", name: "PLACE", ref: "46", paper: "https://doi.org/10.1177/2211068214553022",
    org: "Physical Acoustics Lab, University of Auckland", city: "Auckland", country: "New Zealand", lat: -36.8523, lng: 174.7691,
    website: "https://place.auckland.ac.nz", repo: "https://github.com/PALab/place", docs: "https://place.auckland.ac.nz", logo: "https://github.com/PALab.png?size=96",
    family: "bespoke", mech: "Custom Instrument base class with plugin-per-vendor", standards: [],
    notes: "Each vendor device is implemented as a separate plugin.", license: "LGPL-3.0", verified: true },

  { id: "robochem", name: "RoboChem-Flex / OmniPlatypus", ref: "47", paper: "https://doi.org/10.1038/s44160-026-01053-0",
    org: "Noël Group, Van ’t Hoff Institute for Molecular Sciences, University of Amsterdam", city: "Amsterdam", country: "Netherlands", lat: 52.3547, lng: 4.9540,
    website: "https://hims.uva.nl", repo: "https://github.com/Noel-Research-Group/Robochem_Flex", docs: "", logo: "https://github.com/Noel-Research-Group.png?size=96",
    family: "bespoke", mech: "Custom BaseDevice abstraction with protocol- and vendor-specific subclasses", standards: [],
    notes: "Common device interface exposes named parameters and metadata; subclasses support serial, TCP socket, Modbus and vendor XML; USB-serial devices are auto-identified from stored hardware IDs.", license: "Apache-2.0", verified: true },

  { id: "unilabos", name: "UniLabOS", ref: "48", paper: "https://arxiv.org/abs/2512.21766",
    org: "DP Technology / DeepModeling community", city: "Beijing", country: "China", lat: 39.9900, lng: 116.3300,
    website: "https://blogs.deepmodeling.com/Uni-Lab_30_12_2025/", repo: "https://github.com/deepmodeling/Uni-Lab-OS", docs: "", logo: "https://github.com/deepmodeling.png?size=96",
    family: "formal", mech: "ROS 2 (primary communication fabric)", standards: ["ROS 2", "OPC UA (adapter)", "Modbus (adapter)"],
    notes: "Dedicated device_comms/opcua_client/ module; asyncua and pymodbus declared dependencies.", license: "GPL-3.0", verified: true }
];

/* Projects the paper deliberately excludes (they do not drive instruments directly). */
window.EXCLUDED = [
  { name: "FireWorks [26]", why: "Computational-workflow manager for HPC jobs." },
  { name: "AiiDA [27]", why: "Computational-workflow manager for HPC jobs." },
  { name: "FINALES2 [28]", why: "Inter-lab federation broker." },
  { name: "XDL [29, 30]", why: "Procedure-level description language that compiles to platform-specific execution." }
];
