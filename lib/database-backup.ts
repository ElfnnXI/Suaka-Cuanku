import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

const DEFAULT_BACKUP_FILE_NAME = 'suaka-cuanku-backup.json';

const roleSchema = z.enum(['USER', 'ADMIN', 'AUDITOR']);
const userStatusSchema = z.enum(['ACTIVE', 'SUSPENDED', 'BLOCKED']);
const riskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const loanStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID']);
const paymentStatusSchema = z.enum(['PENDING', 'PAID', 'REJECTED']);

const backupPayloadSchema = z.object({
  metadata: z.object({
    application: z.string(),
    version: z.number(),
    exportedAt: z.string(),
  }),
  summary: z.object({
    users: z.number(),
    loans: z.number(),
    payments: z.number(),
    comments: z.number(),
    auditLogs: z.number(),
    securityQuestions: z.number(),
    rateLimitEntries: z.number(),
    adminBackupSettings: z.number().optional().default(0),
  }),
  data: z.object({
    users: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      password: z.string(),
      sessionVersion: z.number(),
      role: roleSchema,
      status: userStatusSchema,
      riskLevel: riskLevelSchema,
      riskReason: z.string().nullable(),
      loanLimit: z.number(),
      updatedAt: z.string().or(z.date()),
      createdAt: z.string().or(z.date()),
    })),
    loans: z.array(z.object({
      id: z.string(),
      userId: z.string(),
      amount: z.number(),
      interest: z.number(),
      duration: z.number(),
      status: loanStatusSchema,
      createdAt: z.string().or(z.date()),
    })),
    payments: z.array(z.object({
      id: z.string(),
      loanId: z.string(),
      amount: z.number(),
      paidAt: z.string().or(z.date()),
      status: paymentStatusSchema,
    })),
    comments: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      message: z.string(),
      createdAt: z.string().or(z.date()),
    })),
    auditLogs: z.array(z.object({
      id: z.string(),
      auditorId: z.string(),
      action: z.string(),
      description: z.string(),
      details: z.string().nullable(),
      ipAddress: z.string().nullable(),
      userAgent: z.string().nullable(),
      createdAt: z.string().or(z.date()),
    })),
    securityQuestions: z.array(z.object({
      id: z.string(),
      userId: z.string(),
      question: z.string(),
      answer: z.string(),
      createdAt: z.string().or(z.date()),
      updatedAt: z.string().or(z.date()),
    })),
    rateLimitEntries: z.array(z.object({
      key: z.string(),
      count: z.number(),
      resetAt: z.string().or(z.date()),
      createdAt: z.string().or(z.date()),
      updatedAt: z.string().or(z.date()),
    })),
    adminBackupSettings: z.array(z.object({
      id: z.string(),
      adminId: z.string(),
      destinationDirectory: z.string(),
      fileName: z.string(),
      autoBackupEnabled: z.boolean(),
      intervalDays: z.number().nullable(),
      lastBackupAt: z.string().or(z.date()).nullable(),
      nextBackupAt: z.string().or(z.date()).nullable(),
      createdAt: z.string().or(z.date()),
      updatedAt: z.string().or(z.date()),
    })).optional().default([]),
  }),
});

export type DatabaseBackupPayload = z.infer<typeof backupPayloadSchema>;

export type BackupTargetInput = {
  destinationDirectory: string;
  fileName?: string;
};

function toDate(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
}

export function sanitizeBackupFileName(fileName?: string) {
  const trimmed = (fileName ?? '').trim();
  const baseName = path.basename(trimmed || DEFAULT_BACKUP_FILE_NAME);
  const withExtension = path.extname(baseName) ? baseName : `${baseName}.json`;
  return withExtension || DEFAULT_BACKUP_FILE_NAME;
}

export function resolveBackupTarget({ destinationDirectory, fileName }: BackupTargetInput) {
  const trimmedDirectory = destinationDirectory.trim();
  const sanitizedFileName = sanitizeBackupFileName(fileName);
  const resolvedDirectory = path.resolve(trimmedDirectory);
  const resolvedFilePath = path.join(resolvedDirectory, sanitizedFileName);

  return {
    directoryPath: resolvedDirectory,
    fileName: sanitizedFileName,
    filePath: resolvedFilePath,
  };
}

export function calculateNextBackupAt(from: Date, intervalDays: number) {
  return new Date(from.getTime() + intervalDays * 24 * 60 * 60 * 1000);
}

export async function createDatabaseBackupPayload(): Promise<DatabaseBackupPayload> {
  const [users, loans, payments, comments, auditLogs, securityQuestions, rateLimitEntries, adminBackupSettings] =
    await Promise.all([
      prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.loan.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.payment.findMany({ orderBy: { paidAt: 'asc' } }),
      prisma.comment.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.securityQuestion.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.rateLimitEntry.findMany({ orderBy: { createdAt: 'asc' } }),
      prisma.adminBackupSetting.findMany({ orderBy: { createdAt: 'asc' } }),
    ]);

  return {
    metadata: {
      application: 'Suaka Cuanku',
      version: 2,
      exportedAt: new Date().toISOString(),
    },
    summary: {
      users: users.length,
      loans: loans.length,
      payments: payments.length,
      comments: comments.length,
      auditLogs: auditLogs.length,
      securityQuestions: securityQuestions.length,
      rateLimitEntries: rateLimitEntries.length,
      adminBackupSettings: adminBackupSettings.length,
    },
    data: {
      users,
      loans,
      payments,
      comments,
      auditLogs,
      securityQuestions,
      rateLimitEntries,
      adminBackupSettings,
    },
  };
}

export async function writeDatabaseBackup(target: BackupTargetInput) {
  const resolvedTarget = resolveBackupTarget(target);
  const payload = await createDatabaseBackupPayload();

  await mkdir(resolvedTarget.directoryPath, { recursive: true });
  await writeFile(resolvedTarget.filePath, JSON.stringify(payload, null, 2), 'utf8');

  return {
    ...resolvedTarget,
    payload,
  };
}

export async function readDatabaseBackup(target: BackupTargetInput) {
  const resolvedTarget = resolveBackupTarget(target);
  const rawContent = await readFile(resolvedTarget.filePath, 'utf8');
  const parsed = JSON.parse(rawContent) as unknown;
  const payload = backupPayloadSchema.parse(parsed);

  return {
    ...resolvedTarget,
    payload,
  };
}

export async function restoreDatabaseFromBackup(target: BackupTargetInput) {
  const backup = await readDatabaseBackup(target);
  const { payload } = backup;

  await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany();
    await tx.adminBackupSetting.deleteMany();
    await tx.securityQuestion.deleteMany();
    await tx.auditLog.deleteMany();
    await tx.loan.deleteMany();
    await tx.comment.deleteMany();
    await tx.rateLimitEntry.deleteMany();
    await tx.user.deleteMany();

    if (payload.data.users.length > 0) {
      await tx.user.createMany({
        data: payload.data.users.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt) ?? new Date(),
          updatedAt: toDate(item.updatedAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.comments.length > 0) {
      await tx.comment.createMany({
        data: payload.data.comments.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.rateLimitEntries.length > 0) {
      await tx.rateLimitEntry.createMany({
        data: payload.data.rateLimitEntries.map((item) => ({
          ...item,
          resetAt: toDate(item.resetAt) ?? new Date(),
          createdAt: toDate(item.createdAt) ?? new Date(),
          updatedAt: toDate(item.updatedAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.loans.length > 0) {
      await tx.loan.createMany({
        data: payload.data.loans.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.auditLogs.length > 0) {
      await tx.auditLog.createMany({
        data: payload.data.auditLogs.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.securityQuestions.length > 0) {
      await tx.securityQuestion.createMany({
        data: payload.data.securityQuestions.map((item) => ({
          ...item,
          createdAt: toDate(item.createdAt) ?? new Date(),
          updatedAt: toDate(item.updatedAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.adminBackupSettings.length > 0) {
      await tx.adminBackupSetting.createMany({
        data: payload.data.adminBackupSettings.map((item) => ({
          ...item,
          lastBackupAt: toDate(item.lastBackupAt),
          nextBackupAt: toDate(item.nextBackupAt),
          createdAt: toDate(item.createdAt) ?? new Date(),
          updatedAt: toDate(item.updatedAt) ?? new Date(),
        })),
      });
    }

    if (payload.data.payments.length > 0) {
      await tx.payment.createMany({
        data: payload.data.payments.map((item) => ({
          ...item,
          paidAt: toDate(item.paidAt) ?? new Date(),
        })),
      });
    }
  });

  return backup;
}
