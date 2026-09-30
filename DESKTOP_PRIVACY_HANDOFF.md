# Desktop privacy copy (W34)

Website copy now distinguishes Local inference (where the main model runs) from the separate Local-only privacy setting (cloud AI/voice/web-search guards). The homepage, download prerequisites and account panel link to privacy.html#desktop-modes. Privacy metadata and introduction no longer use an unexplained local-first label.

Source evidence: MrSausainis/AVEN-Desktop branch wip/2.1-clean-shutdown resolves to 2cdbd2271e11983b47916d2e4bbd174949e2d602. Inspected aven_config.py and test_local_only_privacy.py at that exact revision and audit checkpoints 40/52. Configuration separates inference_mode from local_only_mode. Regression source covers ordinary local failure cloud fallback when the guard is off, cloud-selected/loading/failed refusal when enabled, cloud SDK transport and retries, local endpoint redirect protection, AI rephrasing/Guardian/vision, voice processing and web search. These desktop tests were inspected, not executed in this website-only environment.

Copy explicitly avoids an all-network/offline guarantee: account/billing, downloads/updates and optional integrations have separate network requirements. Local components must be available before relying on local processing. No desktop behavior, provider settings, feature access or compatibility identifiers were changed.

Validation: existing static publishing integration and git diff --check passed; internal links target the real desktop-modes anchor. This handoff is excluded from the 19-file public build allowlist. Real Windows privacy/network behavior and rendered browser acceptance remain in the agreed final live pass.
