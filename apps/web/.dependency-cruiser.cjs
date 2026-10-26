// « Krizaka first », cycles, unresolvable imports, dev dependencies (@krizaka/config, krizaka/.github#232).
// Run from this workspace (`pnpm depcruise`); the recorded violations are in .dependency-cruiser-known-violations.json and only shrink.
const preset = require("@krizaka/config/dependency-cruiser");

module.exports = { ...preset, options: { ...preset.options, tsConfig: { fileName: "tsconfig.json" } } };
