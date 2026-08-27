# Advanced generation technique evaluation

Decision date: 2026-08-28. This document implements the explicitly deferred
experiment lane from issue #13. Correctness stays with the canonical mission,
placement, routing, and state-space validation pipeline.

## Benchmark method

Run:

```bash
yarn benchmark:dungeon:techniques
```

The machine-readable report is
[`docs/reports/dungeon-technique-benchmark.json`](reports/dungeon-technique-benchmark.json).
The benchmark covers production defaults plus reduced bounds/dense topology,
three-floor placement, and high loop/key/portal pressure. For each root trial it
measures the current bounded solver and a deterministic best-of-four selector.
The selector may score only candidates that pass canonical validation. The soft
score is intentionally provisional and is not a correctness rule or production
API.

The report records success and deterministic replay rates, generation time,
backtracks, routing expansion, trace volume, failure codes, and quality-score
change. Timing is host-specific; success, validation, selected indices, and
serialized replay are the portable evidence.

Measured on the recorded Windows x64 / Node 26 run, all 48 underlying solver
attempts produced canonically valid dungeons. All 12 baseline replays and all 12
selected-candidate replays were byte-identical after canonical encoding.

| Cohort | Baseline mean | Best-of-four mean | Time multiplier | Soft-score delta |
| --- | ---: | ---: | ---: | ---: |
| Production default | 1,689.650 ms | 5,010.666 ms | 2.966x | +1.812 |
| Dense/tight | 3,316.036 ms | 14,148.740 ms | 4.267x | +5.058 |
| Three-floor | 1,779.691 ms | 5,759.695 ms | 3.236x | +2.464 |
| Progression pressure | 2,643.696 ms | 10,820.501 ms | 4.093x | +2.922 |

This is a decision benchmark, not a statistically large reliability sweep; CI
and the scheduled stress lane own broader seed coverage. The result justifies
keeping the current solver and shows that best-of-four buys a modest provisional
quality gain at roughly 3-4.3x measured cost.

## Decisions

| Candidate | Decision | Evidence and boundary |
| --- | --- | --- |
| Custom bounded backtracking + weighted A* | **Keep as production baseline** | It preserves pure TypeScript/browser compatibility, deterministic replay, structured traces, and canonical validation. The benchmark report is the evidence baseline. |
| Deterministic best-of-four search | **Keep experiment-only; reject for live default** | It applies fitness only after hard validation and can improve the provisional score, but requires roughly four candidate generations. It remains an offline/design-time comparison until a product latency budget and intentional fitness function exist. |
| Wave Function Collapse | **Defer; local decoration only** | WFC may later fill wall motifs, furniture zones, biome transitions, or room-local sub-layouts behind an adapter. It may not generate or alter global mission/progression topology. The reference implementation is MIT, while its supplied image samples/tiles are explicitly excluded from that software license. |
| Z3 TypeScript/WASM | **Do not adopt now** | No supported benchmark cohort demonstrates a need that justifies solver/model/debug complexity. Official bindings ship Z3 as WASM and require threads; browsers need `SharedArrayBuffer`-compatible headers and a separately loadable Emscripten worker artifact. That is material risk for the current Vite/Electron/public-web target. Re-evaluate only against persisted failures the bounded solver cannot handle. |
| OR-Tools CP-SAT | **Reject for browser/runtime; retain offline reference** | OR-Tools is Apache-2.0, but official wrappers target C++, Python, C#, and Java rather than a TypeScript/browser runtime. A sidecar would add deployment and replay complexity without current benchmark need. |
| Broader search-based optimization | **Defer** | Validity remains a hard gate. Consider offline candidate selection or parameter tuning only after designers choose an intentional fitness function and measured quality regressions justify the added generation cost. |

Primary project/licensing references:

- [mxgmn/WaveFunctionCollapse and license](https://github.com/mxgmn/WaveFunctionCollapse/blob/master/LICENSE)
- [Z3 TypeScript/WASM binding notes](https://github.com/Z3Prover/z3/blob/master/src/api/js/PUBLISHED_README.md)
- [Z3 repository and MIT license](https://github.com/Z3Prover/z3)
- [OR-Tools supported wrappers](https://github.com/google/or-tools)
- [OR-Tools documentation](https://developers.google.com/optimization/)

## Reconsideration gates

Reopen a solver experiment only when at least one of these is true:

- supported configurations fall below an agreed success-rate target in a large
  deterministic sweep;
- minimized real seeds repeatedly exhaust placement/routing budgets;
- measured p95 generation time misses a product budget after profiling the
  custom stages;
- a local decoration grammar and licensed tile/model corpus exist for a bounded
  WFC experiment;
- designers approve a measurable fitness function whose gain can justify
  best-of-N latency.

Any future adapter must preserve seed replay, emit structured diagnostics, remain
behind an explicit feature flag, and submit its result to the same canonical
validator before the result can be used.
