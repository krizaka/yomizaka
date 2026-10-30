#!/usr/bin/env node
// The fail-on-main guard of the checkout journey: when the journey is red on main, one issue says so (a second red run comments on it).
// Reads the workflow's context from the environment; the credential is the run's own, with issues: write, and is never printed.
import { fileURLToPath } from "node:url";

import { decideIssue, issueFor } from "./checkout-journey-lib.mjs";

export async function guard({ env, fetchImpl = fetch, log = console.log }) {
  const { GITHUB_REPOSITORY: repo, GH_RUN_AUTH: auth, GITHUB_EVENT_NAME: eventName, GITHUB_REF: ref, GITHUB_SHA: sha, GITHUB_SERVER_URL: server, GITHUB_RUN_ID: runId, JOURNEY_FAILURE: failure } = env;
  const api = async (path, init = {}) => {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { ...init, headers: { accept: "application/vnd.github+json", authorization: `Bearer ${auth}`, "content-type": "application/json" } });
    if (!res.ok) throw new Error(`GitHub ${init.method ?? "GET"} ${path}: HTTP ${res.status}`);
    return res.json();
  };
  const onMain = ref === "refs/heads/main";
  const openIssues = onMain ? await api("/issues?state=open&labels=checkout-journey&per_page=50") : [];
  const decision = decideIssue({ eventName, ref, openIssues });
  if (decision.action === "none") return log("not a run on main: no issue");
  const issue = issueFor({ runUrl: `${server}/${repo}/actions/runs/${runId}`, sha, failure });
  if (decision.action === "comment") {
    await api(`/issues/${decision.number}/comments`, { method: "POST", body: JSON.stringify({ body: issue.body }) });
    return log(`commented on #${decision.number}`);
  }
  const created = await api("/issues", { method: "POST", body: JSON.stringify({ ...issue, labels: ["checkout-journey", "bug"] }) });
  return log(`opened #${created.number}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  guard({ env: process.env }).catch((error) => {
    console.error(`guard failed: ${error.message}`);
    process.exitCode = 1;
  });
}
