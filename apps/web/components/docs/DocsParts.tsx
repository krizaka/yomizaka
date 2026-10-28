import type { ReactNode } from "react";

/**
 * The reading scale of a documentation page, on the roles of @krizaka/tokens (the docs template sets the colour and the measure,
 * not the sizes): h2 display-sm, h3 title-lg, h4 title-md. A section is one anchor, cleared of the fixed bar (`--kz-anchor-offset`).
 */
export function DocSection({ id, children }: Readonly<{ id: string; children: ReactNode }>) {
  return (
    <section id={id} className="mb-12 grid scroll-mt-(--kz-anchor-offset,6rem) gap-4">
      {children}
    </section>
  );
}

export const DocH2 = ({ children }: Readonly<{ children: ReactNode }>) => <h2 className="mt-2 text-[length:var(--kz-type-display-sm-size)] leading-tight font-semibold">{children}</h2>;
export const DocH3 = ({ children }: Readonly<{ children: ReactNode }>) => <h3 className="mt-4 text-[length:var(--kz-type-title-lg-size)] leading-snug font-semibold">{children}</h3>;
export const DocH4 = ({ children }: Readonly<{ children: ReactNode }>) => <h4 className="mt-2 text-[length:var(--kz-type-title-md-size)] leading-snug font-semibold text-fg-primary">{children}</h4>;
