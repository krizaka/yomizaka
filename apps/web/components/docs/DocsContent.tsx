import { CodeBlock } from "@krizaka/ui/code-block";
import { DocsArticlePage } from "@krizaka/ui/docs-article-page";
import { DocsNav } from "@krizaka/ui/docs-nav";
import { Ticks } from "@krizaka/ui/page";
import Link from "next/link";

import { YOMIZAKA_API_KEY_RULES } from "@/lib/api-keys";
import { DOCS_SECTIONS, quickstartCode } from "@/lib/docs";
import { apiOperations, apiWebhooks, OPENAPI_PATH } from "@/lib/docs-api";
import { format, getDictionary, type Locale } from "@/lib/i18n";
import { pagePath, SITE_URL } from "@/lib/site";

/**
 * The documentation of Yomizaka, on its own site (yomizaka#387): how a check works, the API (generated from the OpenAPI
 * document), and the data. On the docs template of @krizaka/ui. Every word is a message; the API reference is read from the
 * OpenAPI document, so nothing the document says is typed here.
 */
export function DocsContent({ locale }: Readonly<{ locale: Locale }>) {
  const t = getDictionary(locale);
  const d = t.docs;
  const levels = t.console.analysis.levels;
  const operations = apiOperations();
  const webhooks = apiWebhooks();
  const rules = YOMIZAKA_API_KEY_RULES;
  const home = pagePath(locale, "home");
  const sections = DOCS_SECTIONS.map((id) => ({ id, label: d.sections[id] }));
  return (
    <DocsArticlePage
      linkAs={Link}
      sidebarLabel={d.sidebarLabel}
      sidebar={<DocsNav label={d.navLabel} linkAs={Link} groups={[{ id: "yomizaka", title: t.meta.siteName, items: sections.map((s) => ({ href: `#${s.id}`, label: s.label })) }]} />}
      breadcrumbLabel={d.breadcrumbLabel}
      breadcrumb={[
        { href: home, label: t.meta.siteName },
        { href: pagePath(locale, "docs"), label: d.title },
      ]}
      title={d.title}
      lead={d.lead}
      toc={{ label: d.tocLabel, items: sections }}
    >
      <section id="check" className="scroll-mt-(--kz-anchor-offset,6rem)">
        <h2>{d.sections.check}</h2>
        <p>{d.check.intro}</p>
        <h3>{d.check.kindsTitle}</h3>
        <ul>
          <li>{d.check.compliance}</li>
          <li>{d.check.authenticity}</li>
        </ul>
        <h3>{d.check.findingTitle}</h3>
        <p>{d.check.finding}</p>
        <h3>{d.check.levelsTitle}</h3>
        <p>{format(d.check.levels, { observed: levels["observé"], unusual: levels["inhabituel"], inconsistent: levels["incohérent"] })}</p>
        <h3>{t.verify.guaranteesTitle}</h3>
        <p>{d.check.guaranteesLead}</p>
        <ul>
          {Object.values(t.verify.guarantees).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h3>{t.verify.limitsTitle}</h3>
        <ul>
          {Object.values(t.verify.limits).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p>{d.check.informative}</p>
      </section>

      <section id="api" className="scroll-mt-(--kz-anchor-offset,6rem)">
        <h2>{d.sections.api}</h2>
        <p>{format(d.api.intro, { openapi: OPENAPI_PATH })}</p>
        <p>
          <a href={OPENAPI_PATH}>{d.api.openapiLink}</a>
        </p>
        <h3>{d.api.accessTitle}</h3>
        <p>{format(d.api.access, { prefix: rules.prefix, scopes: rules.scopes.join(", "), days: String(rules.maxExpiryDays), grace: String(rules.rotationGraceHours) })}</p>
        <h3>{d.api.quickstartTitle}</h3>
        <CodeBlock code={quickstartCode(SITE_URL)} language="bash" file="curl" />
        <p>{d.api.quickstartNote}</p>
        <h3>{d.api.routesTitle}</h3>
        {operations.map((op) => (
          <section key={op.id} id={op.id} className="scroll-mt-(--kz-anchor-offset,6rem)" data-testid="api-operation">
            <h4>
              <code>
                {op.method} {op.path}
              </code>
            </h4>
            <p>{op.summary}</p>
            {op.description ? (
              <p>
                <Ticks>{op.description}</Ticks>
              </p>
            ) : null}
            <p>
              {d.api.scope}: <code>{op.scope ?? d.api.noScope}</code>
              {op.parameters.length ? (
                <>
                  {" · "}
                  {d.api.parameters}: <code>{op.parameters.join(", ")}</code>
                </>
              ) : null}
            </p>
            <ul aria-label={d.api.answers}>
              {op.answers.map((answer) => (
                <li key={answer.status}>
                  <code>{answer.status}</code> <Ticks>{answer.description}</Ticks>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <h3>{d.api.errorsTitle}</h3>
        <p>{d.api.errors}</p>
        <h3>{d.api.webhooksTitle}</h3>
        <p>{d.api.webhooks}</p>
        <ul aria-label={d.api.event}>
          {webhooks.map((hook) => (
            <li key={hook.event}>
              <code>{hook.event}</code> <Ticks>{hook.summary}</Ticks>
            </li>
          ))}
        </ul>
      </section>

      <section id="data" className="scroll-mt-(--kz-anchor-offset,6rem)">
        <h2>{d.sections.data}</h2>
        <p>{d.data.intro}</p>
        <p>{d.data.retention}</p>
        <p>{d.data.orazaka}</p>
        <p>
          <Link href={pagePath(locale, "privacy")}>{d.data.privacy}</Link>
        </p>
      </section>
    </DocsArticlePage>
  );
}
