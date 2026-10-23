# Yomizaka API v1

Check a lease or an invoice from your own tool (an ERP, a property-management system, a script). A check is an Orazaka run;
the report is returned as Orazaka produced it (in French). **Yomizaka is a triage tool, not legal advice.**

- Contract: [`/api/v1/openapi.json`](https://www.yomizaka.com/api/v1/openapi.json) (OpenAPI 3.1, generated from the code; a test refuses a route that is not in it).
- Access: a **Pro** plan; the keys are created in the account. `Authorization: Bearer yzk_…`. A key has scopes
  (`checks:write` to start, `reports:read` to read), a life of 1 to 365 days, a rotation with a 24 h grace, and a per-minute
  limit set by the administrator (429 with `Retry-After`). Never put a key in a repository or a log.
- Errors: `{ "code": "…", "error": "…" }`, the code is stable (`API_KEY_MISSING`/`_INVALID`/`_EXPIRED`/`_REVOKED`/`_SUPERSEDED` 401,
  `API_KEY_SCOPE`/`API_PLAN`/`FEATURE_OFF` 403, `NOT_FOUND` 404, `BAD_REQUEST` 400, `BATCH_EMPTY` 422, 429).

## One check

```sh
curl -X POST https://www.yomizaka.com/api/v1/checks \
  -H "Authorization: Bearer $YOMIZAKA_KEY" \
  -F file=@bail.pdf -F check=compliance -F reference=APT-12
# 201 { "check": { "id": "…", "state": "running", … } }

curl https://www.yomizaka.com/api/v1/checks/<id> -H "Authorization: Bearer $YOMIZAKA_KEY"
# poll until "state" is "done" (the "report" is there), "failed" or "refused"
```

`check`: `compliance` (the text against the jurisdiction's rules, Québec by default) or `authenticity` (the file examined as a
file); the French words `conformite` / `authenticite` work too. States: `pending` (waits: see `error`, e.g. `PAYWALL`),
`running`, `reused` (an identical earlier check, free), `done`, `failed`, `refused` (`error` says why: `UNKNOWN_CHECK`,
`NO_TEXT`, `NOT_A_PDF`…). A check is a batch of one row: same path, same refusals.

## A batch

```sh
curl -X POST https://www.yomizaka.com/api/v1/batches -H "Authorization: Bearer $YOMIZAKA_KEY" \
  -F manifest=@immeuble.csv -F files=@bail-1.pdf -F files=@bail-2.pdf
curl https://www.yomizaka.com/api/v1/batches/<id> -H "Authorization: Bearer $YOMIZAKA_KEY"
```

The CSV (`file`, `check`, and optionally `documentType`, `jurisdiction`, `ruleset`, `expectedIssuer`, `reference`, `collection`; the
separator may be `,` `;` or a tab) is the one of the web page, with its template. Each row has its own state and `error`;
a failed row never stops the others. Reading a check or a batch advances it (up to the workspace's concurrency).

## Audit

Every call that starts or reads a check or a batch is recorded in the audit log as `api.check.created`, `api.check.read`,
`api.batch.created`, `api.batch.read`, by `api-key:<key id>` (never the key). A key's last use is kept by `@krizaka/api-keys`.

## Not yet

Signed PDF of a report, idempotent webhooks on finish, a ZIP of the reports (yomizaka#202, follow-ups).
