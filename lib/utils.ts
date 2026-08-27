import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Todas las fechas/horas de la app se muestran en horario de Buenos Aires,
// en formato 24hs, sin importar la zona horaria del navegador o del
// servidor (que en producción suele correr en UTC).
const AR_TIME_ZONE = 'America/Argentina/Buenos_Aires'

export function formatDateTimeAR(
  value: string | number | Date,
  opts?: Intl.DateTimeFormatOptions,
) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleString('es-AR', {
    timeZone: AR_TIME_ZONE,
    hour12: false,
    ...opts,
  })
}

export function formatDateAR(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value)
  return date.toLocaleDateString('es-AR', { timeZone: AR_TIME_ZONE })
}
