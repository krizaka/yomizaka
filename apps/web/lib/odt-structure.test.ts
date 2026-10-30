import { describe, expect, it } from "vitest";

import { odtText } from "./docx-text";
import { zipOf } from "./preflight/fixtures";

const odt = (body: string) =>
  odtText(
    zipOf([
      {
        name: "content.xml",
        data: Buffer.from(`<office:document-content xmlns:text="text">${body}</office:document-content>`),
      },
    ]),
  );

describe("odtText structure (Sonar S3776: the reader is split by role, its output does not move)", () => {
  it("keeps the lines of paragraphs and headings, an empty paragraph is a blank line", () => {
    expect(odt("<text:h>Title</text:h><text:p>One</text:p><text:p/><text:p>Two</text:p>")).toMatchInlineSnapshot(`
      "Title
      One

      Two
      "
    `);
  });

  it("reads spaces, tabs and line breaks only inside a paragraph", () => {
    expect(odt("<text:p>a<text:s/>b<text:tab/>c<text:line-break/>d</text:p><text:s/><text:tab/>outside"))
      .toMatchInlineSnapshot(`
      "a b	c
      d
      "
    `);
  });

  it("drops tracked changes (their text and nested paragraphs), then resumes", () => {
    expect(
      odt(
        "<text:p>before</text:p><text:tracked-changes><text:p>deleted</text:p><text:tracked-changes><text:p>inner</text:p></text:tracked-changes><text:p>still gone</text:p></text:tracked-changes><text:p>after</text:p>",
      ),
    ).toMatchInlineSnapshot(`
      "before
      after
      "
    `);
    expect(odt("<text:tracked-changes/><text:p>kept</text:p>")).toMatchInlineSnapshot(`
      "kept
      "
    `);
  });

  it("puts a line break around notes and note citations, and keeps nested paragraph depth", () => {
    expect(
      odt(
        "<text:p>body<text:note><text:note-citation>1</text:note-citation><text:p>footnote</text:p></text:note> end</text:p>",
      ),
    ).toMatchInlineSnapshot(`
      "body

      1
      footnote

       end
      "
    `);
  });

  it("decodes entities and ignores other markup and an unbalanced closing paragraph", () => {
    expect(odt("</text:p><text:p>x &amp; y &#233; &#x2014; &unknown;<text:span>z</text:span></text:p>"))
      .toMatchInlineSnapshot(`
      "
      x & y é — &unknown;z
      "
    `);
  });

  it("a file without content.xml reads as no text", () => {
    expect(odtText(zipOf([{ name: "other.xml", data: Buffer.from("<a/>") }]))).toBe("");
  });
});
