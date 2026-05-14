export type AppRole = 'USER' | 'ADMIN' | 'AUDITOR';

export function getDefaultRedirectPath(role: string) {
  if (role === 'ADMIN') {
    return '/admin/overview';
  }

  if (role === 'AUDITOR') {
    return '/auditor/overview';
  }

  return '/dashboard/overview';
}

export function getSafeRedirectPath(redirectParam: string | null, role: string) {
  const defaultPath = getDefaultRedirectPath(role);

  if (!redirectParam) {
    return defaultPath;
  }

  if (
    redirectParam.startsWith('/') &&
    !redirectParam.startsWith('//') &&
    !redirectParam.includes('\\')
  ) {
    return redirectParam;
  }

  return defaultPath;
}

export function isSessionVersionCurrent(
  payloadSessionVersion: number | undefined,
  userSessionVersion: number
) {
  return payloadSessionVersion !== undefined && payloadSessionVersion === userSessionVersion;
}
