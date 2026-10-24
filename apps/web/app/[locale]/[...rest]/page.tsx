import { notFound } from "next/navigation";

/** An address under a language that matches no page: the language's 404 (`not-found.tsx` beside this file — a segment's own `not-found` answers only `notFound()` from a matched route, so this catch-all calls it). */
export default function NoSuchPage(): never {
  notFound();
}
