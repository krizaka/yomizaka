import { createI18n, type MessageKey as KeyOf } from "@krizaka/i18n";
import { createI18nReact } from "@krizaka/i18n/react";
import { getLocales } from "expo-localization";

import { asLocale, type Locale } from "@/domain/links";

import sharedEn from "@yomizaka/client/messages/en.json";
import sharedFr from "@yomizaka/client/messages/fr.json";

import ownEn from "./en.json";
import ownFr from "./fr.json";

/** What the iPhone, Android and Mac apps say the same way (the checks, the stages, the result) comes from `@yomizaka/client`. */
const fr = { ...ownFr, ...sharedFr, document: { ...ownFr.document, ...sharedFr.document }, common: { ...ownFr.common, ...sharedFr.common } };
const en = { ...ownEn, ...sharedEn, document: { ...ownEn.document, ...sharedEn.document }, common: { ...ownEn.common, ...sharedEn.common } };

export type Messages = typeof fr;
export type MessageKey = KeyOf<Messages>;
/** French is the reference of the product (Yomizaka is made in Montréal): en.json type-checks against fr.json. */
export const i18n = createI18n<Messages, Locale>({ fr, en }, { defaultLocale: "fr" });
export const { I18nProvider, useI18n } = createI18nReact(i18n);

let current: Locale = asLocale(getLocales()[0]?.languageTag);
/** The language the app speaks now: the API answers in it too (`Accept-Language`). */
export const currentLocale = (): Locale => current;
export const setCurrentLocale = (locale: Locale) => {
  current = locale;
};
