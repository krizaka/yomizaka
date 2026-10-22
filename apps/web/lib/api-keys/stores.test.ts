import { describe } from "vitest";

import { apiKeyStoreContract } from "./contract.testkit";
import { memoryApiKeyStore } from "./memory";

describe("api key store: memory", () => {
  apiKeyStoreContract("memory", memoryApiKeyStore, (n) => `owner-${n}`);
});
