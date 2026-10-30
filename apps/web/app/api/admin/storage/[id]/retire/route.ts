import { providerActionRoute } from "../../routes";

export const dynamic = "force-dynamic";

/** The admin's confirmation that a retiring provider is done: refused while a document still reaches it; its old copies are swept and it is disabled. Audited. */
export const POST = providerActionRoute((service, actor, id) => service.retire(actor, id));
