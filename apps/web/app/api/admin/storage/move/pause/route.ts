import { movePauseRoute } from "../../routes";

export const dynamic = "force-dynamic";

/** Pauses the open move of documents (audited); nothing is lost, it goes on where it stopped. */
export const POST = movePauseRoute(true);
