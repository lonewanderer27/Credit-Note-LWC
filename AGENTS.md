# AGENTS.md

## Purpose
This file provides essential instructions and conventions for AI coding agents working in this Salesforce DX (SFDX) Lightning Web Components (LWC) project. It ensures agents are immediately productive and follow project-specific practices.

---

## Project Overview
- **Type:** Salesforce DX (SFDX) project using Lightning Web Components (LWC)
- **Key directories:**
  - `force-app/main/default/lwc/` — Lightning Web Components
  - `force-app/main/default/classes/` — Apex classes
  - `scripts/` — Utility scripts (Apex, SOQL)

## Build & Test Commands
- **Install dependencies:**
  - `npm install`
- **Run Jest tests:**
  - `npm test` or `npx jest`
- **Deploy to Salesforce org:**
  - `sfdx force:source:deploy -p force-app`
- **Run Apex scripts:**
  - `sfdx force:apex:execute -f scripts/apex/hello.apex`

## Conventions
- **LWC Naming:** Use camelCase for component folders and PascalCase for class names.
- **Tests:** Place Jest tests in `__tests__` folders inside each LWC component directory.
- **Apex:** Store Apex classes in `force-app/main/default/classes/`.
- **SOQL:** Store SOQL queries in `scripts/soql/`.

## Documentation
- See [README.md](README.md) for Salesforce DX and CLI links.
- See [sfdx-project.json](sfdx-project.json) for project configuration.

## Common Pitfalls
- Ensure Salesforce CLI (`sfdx`) is installed and authenticated before deploying or running scripts.
- Always run `npm install` after pulling new dependencies.
- Keep test files in `__tests__` folders for Jest to discover them.

---

_This file is maintained to help AI agents and developers quickly onboard and follow project standards. Update as conventions evolve._
