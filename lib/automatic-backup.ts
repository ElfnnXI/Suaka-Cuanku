import { prisma } from '@/lib/prisma';
import { calculateNextBackupAt, writeDatabaseBackup } from '@/lib/database-backup';
import { logSecurityEvent } from '@/lib/auth';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

const globalForAutomaticBackup = globalThis as unknown as {
  automaticBackupTimer: ReturnType<typeof setInterval> | undefined;
  automaticBackupRunning: boolean | undefined;
};

async function runDueAutomaticBackups() {
  if (globalForAutomaticBackup.automaticBackupRunning) {
    return;
  }

  globalForAutomaticBackup.automaticBackupRunning = true;

  try {
    const now = new Date();
    const dueSettings = await prisma.adminBackupSetting.findMany({
      where: {
        autoBackupEnabled: true,
        nextBackupAt: {
          lte: now,
        },
      },
      include: {
        admin: true,
      },
    });

    for (const setting of dueSettings) {
      if (!setting.intervalDays || setting.intervalDays <= 0) {
        continue;
      }

      try {
        const backupResult = await writeDatabaseBackup({
          destinationDirectory: setting.destinationDirectory,
          fileName: setting.fileName,
        });
        const exportedAt = new Date(backupResult.payload.metadata.exportedAt);
        const nextBackupAt = calculateNextBackupAt(exportedAt, setting.intervalDays);

        await prisma.adminBackupSetting.update({
          where: { id: setting.id },
          data: {
            lastBackupAt: exportedAt,
            nextBackupAt,
          },
        });

        await logSecurityEvent(
          setting.adminId,
          'AUTO_DATABASE_BACKUP',
          `Backup otomatis database dijalankan untuk admin ${setting.admin.email}`,
          `Backup disimpan ke ${backupResult.filePath}`
        );
      } catch (error) {
        console.error('Automatic database backup failed:', error);
      }
    }
  } finally {
    globalForAutomaticBackup.automaticBackupRunning = false;
  }
}

export function startAutomaticBackupScheduler() {
  if (globalForAutomaticBackup.automaticBackupTimer) {
    return;
  }

  globalForAutomaticBackup.automaticBackupTimer = setInterval(() => {
    void runDueAutomaticBackups();
  }, CHECK_INTERVAL_MS);

  void runDueAutomaticBackups();
}
