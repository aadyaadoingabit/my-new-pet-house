# Vendored libraries

Bundled here so the app works without a CDN. All are MIT licensed.

- `three.module.min.js`, `OrbitControls.js`, `OutlineEffect.js`, `RoundedBoxGeometry.js`, `BufferGeometryUtils.js`: [three.js](https://threejs.org) 0.170.0
- `anthropic-sdk.js`: [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) 1.1.0, bundled for the browser with esbuild (`export { default } from "@anthropic-ai/sdk"`)
- `web-llm.js`, `web-llm-worker.js`: [@mlc-ai/web-llm](https://github.com/mlc-ai/web-llm) 0.2.86 (Apache-2.0), bundled for the browser with esbuild; loaded only when the on-device AI is used
