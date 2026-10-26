import { describe, expect, it } from "vitest";

import { libraryScreen, onboardingTarget, welcomeTarget } from "./library-screen";

describe("onboarding: the role is asked once, on its own route, never on the library", () => {
  it("a person with no role is sent to /app/welcome from the library", () => {
    expect(onboardingTarget(null)).toBe("/app/welcome");
    expect(onboardingTarget("tenant")).toBeNull();
  });
  it("the welcome page leaves for the library once a role is set", () => {
    expect(welcomeTarget("landlord")).toBe("/app");
    expect(welcomeTarget(null)).toBeNull();
  });
});

describe("the library's first screen", () => {
  it("one primary action to /check, the tenant file as the secondary only when offered to the role", () => {
    expect(libraryScreen({ documents: 3, screening: false })).toMatchObject({ primary: "/app/check", secondary: null });
    expect(libraryScreen({ documents: 3, screening: true })).toMatchObject({ primary: "/app/check", secondary: "/app/screening" });
  });
  it("shows the table only when there are files, the drop zone and examples when there are none", () => {
    expect(libraryScreen({ documents: 0, screening: false })).toMatchObject({ table: false, emptyDropzone: true });
    expect(libraryScreen({ documents: 2, screening: false })).toMatchObject({ table: true, emptyDropzone: false });
  });
});
