import { pageHtml, PDF_NAME } from "./pickers";

jest.mock("expo-document-picker", () => ({}));
jest.mock("expo-image-picker", () => ({}));
jest.mock("expo-print", () => ({}));

describe("a scan becomes a PDF the checks can read", () => {
  it.each([
    ["scan.jpg", "scan.pdf"],
    ["IMG_0042.HEIC", "IMG_0042.pdf"],
    ["", "document.pdf"],
    ["no-extension", "no-extension.pdf"],
  ])("names %j as %s", (name, expected) => expect(PDF_NAME(name)).toBe(expected));

  it("puts the picture on a page of its own", () => {
    const html = pageHtml("QUJD", "image/png");
    expect(html).toContain('src="data:image/png;base64,QUJD"');
    expect(html).toContain("width:100%");
  });
});
