import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

// The photo stack is proved inside the built image, not only on the CI machine (ADR-0010).
describe("the container smoke check", () => {
  it("is wired in CI and runs the photo check under the production memory limit", () => {
    expect(read(".github/workflows/ci.yml")).toContain("container-smoke: scripts/ci-container-smoke.sh");
    expect(read("scripts/ci-container-smoke.sh")).toContain("--memory=512m");
    expect(read("scripts/ci-container-smoke.sh")).toContain("/smoke/photos.cjs");
    for (const f of ["photos.cjs", "page.jpg", "page.heic"]) expect(existsSync(new URL(`../deploy/docker/smoke/${f}`, import.meta.url)), f).toBe(true);
  });
  it("the Dockerfile carries Tesseract's packages and its trained data into the image", () => {
    const dockerfile = read("deploy/docker/Dockerfile");
    for (const needle of ["tesseract\\.js-core", "@tesseract\\.js-data", "COPY --from=build --chown=yomizaka:yomizaka /ocr/"]) expect(dockerfile).toContain(needle);
  });
  it("the dockerignore keeps the smoke fixtures out of the build context only if they are not needed there", () => {
    expect(read(".dockerignore")).not.toMatch(/deploy/);
  });
});
