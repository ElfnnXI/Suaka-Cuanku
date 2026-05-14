'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

type CaptchaData = {
  dataUrl: string;
  token: string;
};

type CaptchaState = {
  token: string;
  answer: string;
};

type CaptchaProps = {
  onChange: (data: CaptchaState | null) => void;
};

export default function Captcha({ onChange }: CaptchaProps) {
  const [captcha, setCaptcha] = useState<CaptchaData | null>(null);
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fetchCaptcha = useCallback(async () => {
    // Don't clear answer on refresh — keep it so user can retype
    setRefreshing(true);
    setError('');

    try {
      const res = await fetch('/api/auth/captcha', { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat captcha.');

      const data = await res.json();
      if (!mountedRef.current) return;

      setCaptcha(data);
      setLoading(false);
      onChangeRef.current(null);
    } catch {
      if (!mountedRef.current) return;
      setError('Gagal memuat captcha. Coba lagi.');
      setLoading(false);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchCaptcha();
    return () => { mountedRef.current = false; };
  }, [fetchCaptcha]);

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    const trimmed = value.trim();
    if (captcha && trimmed.length >= 3) {
      onChange({ token: captcha.token, answer: trimmed });
    } else {
      onChange(null);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Memuat verifikasi...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 text-sm text-amber-400 py-2">
          <span>{error}</span>
          <button type="button" onClick={fetchCaptcha} className="text-cyan-400 hover:underline text-xs">Coba lagi</button>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <div
              className="relative rounded-lg overflow-hidden border border-white/10 hover:border-cyan-500/40 transition-colors cursor-pointer select-none"
              onClick={fetchCaptcha}
              title="Klik untuk refresh captcha"
            >
              {refreshing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                </div>
              )}
              {captcha && (
                <img
                  src={captcha.dataUrl}
                  alt="Kode verifikasi captcha"
                  className="block h-[44px] w-auto"
                />
              )}
            </div>
            <button
              type="button"
              onClick={fetchCaptcha}
              disabled={refreshing}
              className="flex-shrink-0 rounded-lg p-2 text-gray-400 hover:text-cyan-400 hover:bg-white/5 transition-colors"
              aria-label="Refresh captcha"
              title="Refresh captcha"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="w-full">
            <input
              type="text"
              value={answer}
              onChange={(e) => handleAnswerChange(e.target.value)}
              placeholder="Ketik kode di atas"
              maxLength={6}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="w-full px-4 py-2.5 rounded-xl text-center text-lg font-mono tracking-[0.3em] focus:outline-none transition-all placeholder-gray-500 uppercase"
            />
          </div>
        </>
      )}
    </div>
  );
}
