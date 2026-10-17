---
title: "Reverse Engineer Anything (REA) Prompting Guide"
description: "A comprehensive guide on how to prompt AI coding agents for reverse engineering binaries, Electron apps, APKs, networks, and databases using REA."
date: "2026-10-17"
tags: ["reverse-engineering", "rea", "mcp", "prompting", "guide"]
---

# Prompting Guide: Reverse Engineer Anything (REA)

When prompting an AI assistant equipped with **REA**, the key is to give the agent a **clear target**, a **specific feature or hypothesis**, and an **evidence-based goal** (e.g., explain, trace, compare, or reconstruct).

---

## 1. The Anatomy of an Effective REA Prompt

A high-performing REA prompt combines four core elements:

$$
\text{[Target]} + \text{[Feature / Hypothesis]} + \text{[Evidence Requirement]} + \text{[End Goal]}
$$

1. **Target**: The exact local path, binary name, ASAR bundle, APK file, or live URL/port.
2. **Feature / Focus Area**: The specific user flow, protocol, algorithm, or UI interaction.
3. **Evidence Requirement**: Explicitly ask for code/decompilation references, call paths, or Evidence IDs.
4. **End Goal**: Architecture explanation, identifying limitations/unknowns, or a clean-room implementation.

---

## 2. Prompt Templates by Target

### A. Electron & JavaScript Apps (Slack, Notion, VS Code, Discord)

> **Template**:
> *"Inspect the [extracted app directory or ASAR path] using REA. Trace how the [feature name] works, map the IPC boundaries between the renderer and main processes, and show the code evidence."*

```markdown
Analyze `/Applications/Slack.app/Contents/Resources/app.asar`.
How does the offline draft caching mechanism work?
Trace the Electron IPC handlers and show the code evidence.
```

---

### B. Native Binaries (Mach-O, ELF, PE, C/C++, Rust, Go)

> **Template**:
> *"Open the binary at [path]. Find how [functionality/API] is handled, decompile the relevant procedures, and summarize the control flow with Evidence IDs."*

```markdown
Open the native binary `/usr/local/bin/mycli`.
Search for procedures handling `--auth` and license validation.
Show the pseudocode, callers, and any cryptographic or hashing functions used.
```

---

### C. Android Packages (APK / AAB)

> **Template**:
> *"Inspect the APK at [path]. Find the classes handling [feature/network call], trace incoming references to [method name], and show the decompiled logic."*

```markdown
Inspect `app-release.apk`.
Trace where biometric authentication is checked and show whether
the cryptographic token is stored in the Android Keystore or SharedPreferences.
```

---

### D. Clean-Room Feature Reconstruction

> **Template**:
> *"Investigate how [Target App] implements [Feature X]. First, extract data structures and workflow using REA. Second, outline any edge cases or unknowns. Third, build a clean-room TypeScript/Python implementation for our project based on that design."*

```markdown
Understand how fuzzy file search works in the desktop editor at `/path/to/app`.
Show me the algorithm details and score calculation from the decompiled code,
then implement a clean, standalone version in TypeScript for our repository.
```

---

### E. Comparing Two Versions (Diffing Behavior)

> **Template**:
> *"Compare version A at [pathA] and version B at [pathB]. What changed in the [specific module or API contract], and what new behavior was introduced?"*

```markdown
Compare `v1.2/core.dll` and `v1.3/core.dll`.
Identify which functions were added or modified in the network serialization pipeline.
```

---

### F. Network Protocols, Databases & Web Observation

* **SQLite Snapshot**:
  ```markdown
  Inspect the database snapshot at `data.sqlite`.
  Show the table schema and sample rows for user preferences and encrypted keys.
  ```

* **Network & PCAP**:
  ```markdown
  Inspect the packet capture `traffic.pcap`.
  Filter for DNS queries and TLS SNI handshakes to determine which telemetry endpoints
  the app communicates with on startup.
  ```

* **Active Browser Session**:
  ```markdown
  Attach to the browser target at `localhost:3000`.
  Trace the click event listener on `#export-button` back to its module source.
  ```

---

## 3. Best Practices & Pro Tips

| Technique | Why It Helps |
| :--- | :--- |
| **Ask for Unknowns** | Adding *"List any unknowns or bounded search limitations"* prevents hallucinated or unverified logic. |
| **Start Summary-First** | For large bundles, ask: *"Start with a summary overview of the app graph before drilling into specific modules."* |
| **Provide Absolute Paths** | Always pass absolute filesystem paths (e.g. `/Applications/...` or `/Users/...`) so REA tools bind directly without guessing. |
| **Separate Extraction from Coding** | Tell the agent: *"First confirm the decompiled behavior and cite the Evidence IDs. Do not write new code until I approve the findings."* |
