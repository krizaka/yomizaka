import { createI18n } from "@krizaka/i18n";
import { createI18nReact } from "@krizaka/i18n/react";
import { getLocales } from "expo-localization";

import { asLocale, type Locale } from "@/domain/links";

import en from "./en.json";
import fr from "./fr.json";

export type Messages = typeof fr;
/** French is the reference of the product (Yomizaka is made in Montréal): en.json type-checks against fr.json. */
export const i18n = createI18n<Messages, Locale>({ fr, en }, { defaultLocale: "fr" });
export const { I18nProvider, useI18n } = createI18nReact(i18n);

let current: Locale = asLocale(getLocales()[0]?.languageTag);
/** The language the app speaks now: the API answers in it too (`Accept-Language`). */
export const currentLocale = (): Locale => current;
export const setCurrentLocale = (locale: Locale) => {
  current = locale;
};
