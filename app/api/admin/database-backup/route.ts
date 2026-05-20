import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { startAutomaticBackupScheduler } from '@/lib/automatic-backup';
import { getUserWithPasswordFromRequest, logSecurityEvent } from '@/lib/auth';
import {
  calculateNextBackupAt,
  readDatabaseBackup,
  restoreDatabaseFromBackup,
  sanitizeBackupFileName,
  writeDatabaseBackup,
} from '@/lib/database-backup';
import { prisma } from '@/lib/prisma';
import { enforceMutationSecurity, enforceRateLimit, getClientIp, withPrivateCache } from '@/lib/security';

export const runtime = 'nodejs';

const intervalSchema = z.union([z.literal(1), z.literal(3), z.literal(7)]);

const manualBackupSchema = z.object({
  destinationDirectory: z.string().trim().min(1, 'Folder backup wajib diisi'),
  fileName: z.string().trim().optional(),
  password: z.string().min(1, 'Password admin wajib diisi'),
});

const restoreBackupSchema = z.object({
  destinationDirectory: z.string().trim().min(1, 'Folder backup restore wajib diisi'),
  fileName: z.string().trim().min(1, 'Nama file backup restore wajib diisi'),
  password: z.string().min(1, 'Password admin wajib diisi'),
});

const backupSettingsSchema = z.object({
  destinationDirectory: z.string().trim().min(1, 'Folder backup wajib diisi'),
  fileName: z.string().trim().optional(),
  autoBackupEnabled: z.boolean(),
  intervalDays: intervalSchema.nullable(),
  password: z.string().min(1, 'Password admin wajib diisi'),
}).superRefine((value, ctx) => {
  if (value.autoBackupEnabled && !value.intervalDays) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Interval backup otomatis wajib dipilih',
      path: ['intervalDays'],
    });
  }
});

async function requireAdminWithPassword(request: NextRequest) {
  const admin = await getUserWithPasswordFromRequest(request);

  if (!admin) {
    return withPrivateCache(NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    ));
  }

  if (admin.role !== 'ADMIN') {
    return withPrivateCache(NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    ));
  }

  if (admin.status === 'BLOCKED') {
    return withPrivateCache(NextResponse.json(
      { error: 'Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.' },
      { status: 403 }
    ));
  }

  if (admin.status === 'SUSPENDED') {
    return withPrivateCache(NextResponse.json(
      { error: 'Akun Anda sedang ditangguhkan. Hubungi admin untuk informasi lebih lanjut.' },
      { status: 403 }
    ));
  }

  return admin;
}

startAutomaticBackupScheduler();

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminWithPassword(request);
    if (admin instanceof Response) {
      return admin;
    }

    const setting = await prisma.adminBackupSetting.findUnique({
      where: { adminId: admin.id },
      select: {
        destinationDirectory: true,
        fileName: true,
        autoBackupEnabled: true,
        intervalDays: true,
        lastBackupAt: true,
        nextBackupAt: true,
      },
    });

    return withPrivateCache(NextResponse.json({
      setting: setting ?? null,
    }));
  } catch (error) {
    console.error('Get database backup settings error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Gagal mengambil pengaturan backup database' },
      { status: 500 }
    ));
  }
}

export async function POST(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return withPrivateCache(securityError);
    }

    const admin = await requireAdminWithPassword(request);
    if (admin instanceof Response) {
      return admin;
    }

    const rateLimited = await enforceRateLimit({
      key: `admin-database-backup:${admin.id}:${getClientIp(request)}`,
      limit: 3,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return withPrivateCache(rateLimited);
    }

    const body = await request.json();
    const { destinationDirectory, fileName, password } = manualBackupSchema.parse(body);

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return withPrivateCache(NextResponse.json(
        { error: 'Password admin tidak valid' },
        { status: 400 }
      ));
    }

    const backupResult = await writeDatabaseBackup({
      destinationDirectory,
      fileName,
    });

    const existingSetting = await prisma.adminBackupSetting.findUnique({
      where: { adminId: admin.id },
      select: {
        autoBackupEnabled: true,
        intervalDays: true,
      },
    });
    const exportedAt = new Date(backupResult.payload.metadata.exportedAt);
    const nextBackupAt =
      existingSetting?.autoBackupEnabled && existingSetting.intervalDays
        ? calculateNextBackupAt(exportedAt, existingSetting.intervalDays)
        : null;

    await prisma.adminBackupSetting.upsert({
      where: { adminId: admin.id },
      update: {
        destinationDirectory: backupResult.directoryPath,
        fileName: backupResult.fileName,
        lastBackupAt: exportedAt,
        nextBackupAt: nextBackupAt ?? undefined,
      },
      create: {
        adminId: admin.id,
        destinationDirectory: backupResult.directoryPath,
        fileName: backupResult.fileName,
        lastBackupAt: exportedAt,
        nextBackupAt,
      },
    });

    await logSecurityEvent(
      admin.id,
      'DATABASE_BACKUP',
      `Admin ${admin.email} membuat backup database`,
      `Backup disimpan ke ${backupResult.filePath}`,
      getClientIp(request),
      request.headers.get('user-agent') ?? undefined
    );

    return withPrivateCache(NextResponse.json({
      message: 'Backup database berhasil dibuat',
      filePath: backupResult.filePath,
      directoryPath: backupResult.directoryPath,
      fileName: backupResult.fileName,
      exportedAt: backupResult.payload.metadata.exportedAt,
      summary: backupResult.payload.summary,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Database backup error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Gagal membuat backup database' },
      { status: 500 }
    ));
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return withPrivateCache(securityError);
    }

    const admin = await requireAdminWithPassword(request);
    if (admin instanceof Response) {
      return admin;
    }

    const rateLimited = await enforceRateLimit({
      key: `admin-database-restore:${admin.id}:${getClientIp(request)}`,
      limit: 2,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return withPrivateCache(rateLimited);
    }

    const body = await request.json();
    const { destinationDirectory, fileName, password } = restoreBackupSchema.parse(body);

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return withPrivateCache(NextResponse.json(
        { error: 'Password admin tidak valid' },
        { status: 400 }
      ));
    }

    const backupPreview = await readDatabaseBackup({
      destinationDirectory,
      fileName,
    });

    const restoredBackup = await restoreDatabaseFromBackup({
      destinationDirectory,
      fileName,
    });

    await logSecurityEvent(
      admin.id,
      'DATABASE_RESTORE',
      `Admin ${admin.email} melakukan restore database`,
      `Restore dari ${backupPreview.filePath}`,
      getClientIp(request),
      request.headers.get('user-agent') ?? undefined
    );

    return withPrivateCache(NextResponse.json({
      message: 'Restore database berhasil dijalankan',
      filePath: restoredBackup.filePath,
      exportedAt: restoredBackup.payload.metadata.exportedAt,
      summary: restoredBackup.payload.summary,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Database restore error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Gagal menjalankan restore database' },
      { status: 500 }
    ));
  }
}

export async function PUT(request: NextRequest) {
  try {
    const securityError = enforceMutationSecurity(request, { requireCsrf: true });
    if (securityError) {
      return withPrivateCache(securityError);
    }

    const admin = await requireAdminWithPassword(request);
    if (admin instanceof Response) {
      return admin;
    }

    const rateLimited = await enforceRateLimit({
      key: `admin-database-backup-settings:${admin.id}:${getClientIp(request)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
    });
    if (rateLimited) {
      return withPrivateCache(rateLimited);
    }

    const body = await request.json();
    const { destinationDirectory, fileName, autoBackupEnabled, intervalDays, password } =
      backupSettingsSchema.parse(body);

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return withPrivateCache(NextResponse.json(
        { error: 'Password admin tidak valid' },
        { status: 400 }
      ));
    }

    const now = new Date();
    const sanitizedFileName = sanitizeBackupFileName(fileName);
    const nextBackupAt = autoBackupEnabled && intervalDays
      ? calculateNextBackupAt(now, intervalDays)
      : null;

    const setting = await prisma.adminBackupSetting.upsert({
      where: { adminId: admin.id },
      update: {
        destinationDirectory: destinationDirectory.trim(),
        fileName: sanitizedFileName,
        autoBackupEnabled,
        intervalDays: autoBackupEnabled ? intervalDays : null,
        nextBackupAt,
      },
      create: {
        adminId: admin.id,
        destinationDirectory: destinationDirectory.trim(),
        fileName: sanitizedFileName,
        autoBackupEnabled,
        intervalDays: autoBackupEnabled ? intervalDays : null,
        nextBackupAt,
      },
      select: {
        destinationDirectory: true,
        fileName: true,
        autoBackupEnabled: true,
        intervalDays: true,
        lastBackupAt: true,
        nextBackupAt: true,
      },
    });

    await logSecurityEvent(
      admin.id,
      'UPDATE_DATABASE_BACKUP_SETTINGS',
      `Admin ${admin.email} memperbarui pengaturan backup database`,
      `Folder: ${setting.destinationDirectory}, file: ${setting.fileName}, auto: ${setting.autoBackupEnabled}, interval: ${setting.intervalDays ?? '-'} hari`,
      getClientIp(request),
      request.headers.get('user-agent') ?? undefined
    );

    return withPrivateCache(NextResponse.json({
      message: 'Pengaturan backup otomatis berhasil disimpan',
      setting,
    }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return withPrivateCache(NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      ));
    }

    console.error('Save database backup settings error:', error);
    return withPrivateCache(NextResponse.json(
      { error: 'Gagal menyimpan pengaturan backup database' },
      { status: 500 }
    ));
  }
}
