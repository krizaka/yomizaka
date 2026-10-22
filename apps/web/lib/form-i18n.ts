/** The translator a @krizaka/ui form wants (`useForm({ ...formI18n(say, locale) })`): its validation messages come from the app's messages. */
export const formI18n = (say: (key: string, vars?: Record<string, string | number>) => string, locale: string) => ({
  i18n: { t: (key: string, vars?: unknown) => say(key, vars as Record<string, string | number> | undefined), locale },
});
