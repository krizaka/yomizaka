import { movePauseRoute } from "../../routes";

export const dynamic = "force-dynamic";

/** Resumes the open move of documents (audited); a resume also tries the failed objects again. */
export const POST = movePauseRoute(false);
