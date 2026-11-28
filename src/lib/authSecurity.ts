/**
 * Utilidades de seguridad de cuentas: traducción de errores de Supabase Auth,
 * reglas de contraseña y URL de retorno para los correos (confirmación / recuperación).
 */

const AUTH_ERRORS: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
  [/email not confirmed/i, 'Todavía no confirmaste tu correo. Revisa tu bandeja de entrada (y la carpeta de spam).'],
  [/user is banned|banned/i, 'Esta cuenta está suspendida. Si crees que es un error, escribe al administrador.'],
  [/user already registered|already been registered|already exists/i, 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.'],
  [/password should be at least|password is too short|weak.?password/i, 'La contraseña es demasiado débil. Usa al menos 8 caracteres con letras y números.'],
  [/pwned|data breach|known to be/i, 'Esa contraseña apareció en filtraciones de datos. Elige otra distinta.'],
  [/new password should be different/i, 'La nueva contraseña debe ser distinta de la anterior.'],
  [/rate limit|too many requests|over_email_send_rate_limit|for security purposes/i, 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.'],
  [/error sending (confirmation|recovery|magic link)? ?(e-?mail)?|smtp/i, 'No pudimos enviar el correo ahora mismo. Inténtalo más tarde o contacta al administrador.'],
  [/token has expired|otp.*expired|expired/i, 'El código o enlace venció. Pide uno nuevo.'],
  [/invalid (otp|token)|token.*invalid|invalid totp code|invalid mfa/i, 'El código no es correcto. Revísalo e inténtalo de nuevo.'],
  [/unable to validate email|invalid email|email address .* is invalid/i, 'El correo no es válido.'],
  [/signups not allowed|signup is disabled/i, 'El registro está cerrado temporalmente.'],
  [/auth session missing|not authenticated|jwt expired/i, 'Tu sesión venció. Vuelve a iniciar sesión.'],
  [/aal2|mfa/i, 'Necesitas completar la verificación en 2 pasos.'],
  [/failed to fetch|network/i, 'Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'],
]

/** Convierte un error de Supabase (normalmente en inglés) en un mensaje claro en español. */
export function authErrorEs(err: unknown, fallback = 'Ocurrió un error. Inténtalo de nuevo.'): string {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  if (!msg) return fallback
  for (const [re, es] of AUTH_ERRORS) if (re.test(msg)) return es
  // Los errores de nuestra base de datos ya vienen en español
  return /[áéíóúñ¿¡]|\b(el|la|los|las|tu|no|de)\b/i.test(msg) ? msg : fallback
}

export const PASSWORD_MIN = 8

export interface PasswordCheck {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  ok: boolean
  issues: string[]
}

const COMMON = [
  '12345678', '123456789', '1234567890', 'password', 'contraseña', 'contrasena', 'qwertyui', 'qwerty123',
  'cuba1234', 'habana123', 'iloveyou', '11111111', '00000000', 'abc12345', 'islamercado',
]

/** Evalúa la contraseña: exige 8+ caracteres, letras y números, y que no sea obvia. */
export function checkPassword(pw: string, context: string[] = []): PasswordCheck {
  const issues: string[] = []
  const lower = pw.toLowerCase()
  if (pw.length < PASSWORD_MIN) issues.push(`Al menos ${PASSWORD_MIN} caracteres`)
  if (!/[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(pw)) issues.push('Incluye letras')
  if (!/[0-9]/.test(pw)) issues.push('Incluye números')
  const obvious =
    COMMON.some((c) => lower.includes(c)) ||
    /^(.)\1+$/.test(pw) ||
    context.some((c) => c && c.length >= 4 && lower.includes(c.toLowerCase()))
  if (obvious) issues.push('Evita contraseñas obvias o tu nombre/correo')

  let score = 0
  if (pw.length >= PASSWORD_MIN) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) score++
  if (issues.length) score = Math.min(score, 1)
  const s = Math.max(0, Math.min(4, score)) as PasswordCheck['score']
  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Muy segura']
  return { score: s, label: labels[s], ok: issues.length === 0, issues }
}

/** URL a la que vuelven los enlaces de los correos (raíz del sitio, sin hash: HashRouter). */
export function authRedirectUrl(): string {
  if (typeof window === 'undefined') return ''
  return window.location.origin + window.location.pathname
}

/** Ofusca un correo para mostrarlo: ju***@gmail.com */
export function maskEmail(email: string): string {
  const [u, d] = email.split('@')
  if (!d) return email
  return `${u.slice(0, 2)}${'*'.repeat(Math.max(2, u.length - 2))}@${d}`
}
