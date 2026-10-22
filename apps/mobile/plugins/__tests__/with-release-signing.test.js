const fs = require("node:fs");
const path = require("node:path");

const { addReleaseSigning } = require("../with-release-signing");

const template = fs.readFileSync(path.join(__dirname, "signing.sample.txt"), "utf8");

describe("the Android release signing plugin", () => {
  it("adds a release signing config read from the environment, never a key in the repository", () => {
    const out = addReleaseSigning(template);
    expect(out).toContain('storeFile file(System.getenv("KRIZAKA_ANDROID_KEYSTORE"))');
    expect(out).toContain('keyPassword System.getenv("KRIZAKA_ANDROID_KEY_PASSWORD")');
  });

  it("signs the release build with it when the environment names a key, and keeps the debug key otherwise", () => {
    const out = addReleaseSigning(template);
    expect(out).toContain('signingConfig System.getenv("KRIZAKA_ANDROID_KEYSTORE") ? signingConfigs.release : signingConfigs.debug');
    expect(out.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1); // the debug build type's own
  });

  it("is idempotent", () => {
    const once = addReleaseSigning(template);
    expect(addReleaseSigning(once)).toBe(once);
  });

  it("refuses a template it does not know instead of building an unsigned release", () => {
    expect(() => addReleaseSigning("android {}")).toThrow("signingConfigs block");
  });
});
