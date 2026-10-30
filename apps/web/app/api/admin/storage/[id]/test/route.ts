import { providerActionRoute } from "../../routes";

export const dynamic = "force-dynamic";

/** Tests the connection again (a probe write, read, compare, delete) and records the residency it found. Only a green test verifies a draft. Audited. */
export const POST = providerActionRoute((service, actor, id) => service.test(actor, id), "provider");
