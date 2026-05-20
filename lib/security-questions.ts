import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const SECURITY_QUESTIONS = [
  { key: 'NAMA_MASA_KECIL', label: 'Nama Masa Kecil', type: 'text', minLength: 1, placeholder: 'Nama panggilan masa kecil Anda' },
  { key: 'KOTA_IMPIAN', label: 'Kota Impian', type: 'text', minLength: 1, placeholder: 'Kota impian yang ingin Anda tinggali' },
  { key: 'ANGKA_HARAPAN', label: 'Angka Harapan', type: 'digit', minLength: 4, placeholder: 'Minimal 4 angka, contoh: 8719' },
  { key: 'KATA_ABSURD', label: 'Kata Absurd', type: 'text', minLength: 1, placeholder: 'Satu kata absurd yang hanya Anda ingat' },
  { key: 'MEREK_FAVORIT', label: 'Merek Favorit', type: 'text', minLength: 1, placeholder: 'Merek favorit yang bermakna bagi Anda' },
] as const;

export const QUESTION_KEYS = SECURITY_QUESTIONS.map((q) => q.key);

export async function hashAnswer(answer: string) {
  return bcrypt.hash(answer.trim().toLowerCase(), 10);
}

export async function verifyAnswer(answer: string, hash: string) {
  return bcrypt.compare(answer.trim().toLowerCase(), hash);
}

export const securityQuestionsSchema = z.array(z.object({
  question: z.string().min(1, 'Pertanyaan wajib dipilih'),
  answer: z.string().min(1, 'Jawaban wajib diisi'),
})).length(5).superRefine((items, ctx) => {
  for (const item of items) {
    const def = SECURITY_QUESTIONS.find((q) => q.key === item.question);
    if (!def) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Pertanyaan "${item.question}" tidak dikenali`,
        path: [],
      });
      return;
    }

    if (def.type === 'digit' && !/^\d{4,}$/.test(item.answer)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `"${def.label}" harus berupa minimal 4 angka`,
        path: [],
      });
    }
  }
});
