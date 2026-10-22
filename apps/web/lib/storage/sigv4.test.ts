import { describe, expect, it } from "vitest";

import { EMPTY_SHA256, presignGet, signRequest } from "./sigv4";

describe("Signature V4, against AWS's published test vectors", () => {
  it("get-vanilla (header signing)", () => {
    const h = signRequest(
      { accessKeyId: "AKIDEXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "service" },
      { method: "GET", url: "https://example.amazonaws.com/", payloadHash: EMPTY_SHA256, now: new Date("2015-08-30T12:36:00Z") },
    );
    expect(h.authorization).toBe("AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
  });

  it("the S3 presigned GET example (query-string signing)", () => {
    const url = presignGet(
      { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1", service: "s3" },
      "https://examplebucket.s3.amazonaws.com/test.txt",
      86400,
      new Date("2013-05-24T00:00:00Z"),
    );
    expect(new URL(url).searchParams.get("X-Amz-Signature")).toBe("aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
});
