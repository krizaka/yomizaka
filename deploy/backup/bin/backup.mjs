#!/usr/bin/env node
// node bin/backup.mjs            the nightly backup + restore drill (exit 1 and « BACKUP_FAILED <code> » on any failure)
// node bin/backup.mjs check      the dead-man's switch: exit 1 when the newest backup is missing or older than 36 h
import { realPorts } from "../src/adapters.mjs";
import { BackupError, RETENTION_DAYS } from "../src/plan.mjs";
import { checkFresh, runBackup } from "../src/run.mjs";

const mode = process.argv[2] ?? "backup";
const environment = process.env.APP_ENVIRONMENT === "prod" ? "prod" : "dev";
let real;
try {
  real = await realPorts(process.env);
  const { ports } = real;
  if (!ports.destination.store) throw new BackupError("NO_DESTINATION", "no backup destination: an admin sets a default provider for « backups » (Administration → Storage)");
  if (mode === "check") {
    console.log(`fresh: ${await checkFresh(ports.destination.store, environment, ports.clock.now())}`);
  } else {
    const days = Number(process.env.BACKUP_RETENTION_DAYS ?? RETENTION_DAYS);
    const manifest = await runBackup(ports, { environment, recipient: process.env.BACKUP_AGE_RECIPIENT, retentionDays: days });
    console.log(`BACKUP_OK ${manifest.key} ${manifest.bytes} bytes`);
  }
} catch (error) {
  console.error(`BACKUP_FAILED ${error instanceof BackupError ? error.code : "UNEXPECTED"} ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await real?.close().catch(() => {});
}
