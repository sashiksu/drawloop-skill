# Security policy

## Reporting a vulnerability

Email: sashiksu@gmail.com

Please include:
- A description of the vulnerability
- Steps to reproduce
- Affected versions

I will acknowledge within 72 hours and aim to ship a fix or mitigation within 14 days for critical issues.

## Scope

drawloop-skill runs a local server bound to `localhost`. It does NOT:
- Expose itself to the network
- Authenticate or authorize requests
- Store secrets

If you find a way to exfiltrate files outside the working directory via path-traversal in `?path=`, that's in scope. Please report.

## Out of scope

- Vulnerabilities in upstream dependencies (`@excalidraw/excalidraw`, etc.) — report those upstream
- DOS via large `.excalidraw` files — drawloop-skill does not hard-limit input size
- Issues that require local code execution (the server is `localhost`-only by design)
