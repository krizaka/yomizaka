/** The pure arithmetic of the operations page, free of the database so the client view and the tests share it. */

/** A role's own limit (> 0) wins over the server's; -1 means the role has none. Pure, tested. */
export const budgetLimit = (roleLimit: number, serverLimit: number) =>
  roleLimit > 0 ? Math.min(roleLimit, serverLimit || roleLimit) : serverLimit;

/** Share of a budget in use, 0–1, never above 1, 0 when there is no budget. Pure, tested. */
export const usageShare = (used: number, limit: number) => (limit > 0 ? Math.min(1, used / limit) : 0);
