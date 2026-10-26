import { ApiError } from "@krizaka/app-client";
import { Button, Screen, TextField, Txt } from "@krizaka/ui/native";
import { Redirect } from "expo-router";
import * as Linking from "expo-linking";
import * as React from "react";
import { View } from "react-native";

import { AUTH, useAuth } from "@/auth";
import { webUrl } from "@/config";
import { routes } from "@/domain/links";
import { useI18n } from "@/i18n";
import { useLocale } from "@/use-locale";

/** A wrong address or password answers 400 or 401; anything else is the network or the server. */
const REFUSALS = new Set([400, 401]);

export default function SignIn() {
  const { t } = useI18n();
  const { locale } = useLocale();
  const { status, signIn } = useAuth();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [busy, setBusy] = React.useState(false);

  if (status === AUTH.signedIn) return <Redirect href={routes.verify(locale) as never} />;

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError && REFUSALS.has(e.status) ? t("signIn.wrong") : t("common.offline"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: 8 }}>
        <Txt variant="title">{t("signIn.title")}</Txt>
        <Txt tone="secondary">{t("signIn.lead")}</Txt>
      </View>
      <TextField testID="email" label={t("signIn.email")} value={email} onValueChange={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" />
      <TextField
        testID="password"
        label={t("signIn.password")}
        value={password}
        onValueChange={setPassword}
        secureTextEntry
        autoComplete="off"
        textContentType="none"
        autoCorrect={false}
        error={error}
      />
      <Button testID="submit" variant="primary" label={t("signIn.submit")} onPress={submit} loading={busy} disabled={!email || !password} />
      <Button variant="ghost" label={t("signIn.createAccount")} onPress={() => void Linking.openURL(webUrl("/fr"))} />
      <Txt tone="muted" variant="caption">
        {t("disclaimer")}
      </Txt>
    </Screen>
  );
}
