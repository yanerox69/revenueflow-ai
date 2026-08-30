import type { Period, RelativeDay } from './intent';

/**
 * Aritmética de fechas con huso horario, sin librerías.
 *
 * Todo se calcula en la hora local del negocio y se convierte a UTC al final.
 * Un venezolano que dice "el jueves en la tarde" se refiere al jueves en
 * Caracas, no en el servidor.
 */

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=domingo … 6=sábado
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export function localParts(date: Date, timeZone: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    // 'en-US' con hour12:false devuelve 24 para la medianoche.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday as string] ?? 0,
  };
}

/** Convierte una hora local del negocio a un instante UTC. */
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const seen = localParts(new Date(guess), timeZone);
  const seenAsUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hour, seen.minute);
  return new Date(guess - (seenAsUtc - guess));
}

export interface PeriodWindow {
  startHour: number;
  endHour: number;
}

export function periodWindow(period: Period): PeriodWindow {
  switch (period) {
    case 'MORNING':
      return { startHour: 6, endHour: 12 };
    case 'AFTERNOON':
      return { startHour: 12, endHour: 18 };
    case 'EVENING':
      return { startHour: 18, endHour: 22 };
    default:
      return { startHour: 0, endHour: 24 };
  }
}

export interface TargetDay {
  year: number;
  month: number;
  day: number;
  weekday: number;
}

/**
 * Traduce "el jueves" / "mañana" / "la próxima semana" a un día concreto,
 * en la zona del negocio.
 */
export function resolveTargetDay(
  now: Date,
  timeZone: string,
  weekday: number | null,
  relativeDay: RelativeDay,
  offsetDays = 0,
): TargetDay {
  const today = localParts(now, timeZone);
  let add = offsetDays;

  if (relativeDay === 'TOMORROW') {
    add += 1;
  } else if (weekday != null) {
    let delta = (weekday - today.weekday + 7) % 7;
    // "el jueves" dicho un jueves se refiere al próximo, no a hoy.
    if (delta === 0 && relativeDay !== 'TODAY') delta = 7;
    if (relativeDay === 'NEXT_WEEK') delta += 7;
    add += delta;
  } else if (relativeDay === 'NEXT_WEEK') {
    add += 7;
  }

  const base = Date.UTC(today.year, today.month - 1, today.day) + add * 86_400_000;
  const d = new Date(base);

  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
  };
}

export interface AvailabilityRule {
  weekday: number;
  start_time: string; // 'HH:MM:SS'
  end_time: string;
}

export interface SlotSearch {
  rules: AvailabilityRule[];
  /** Instantes ya ocupados. */
  taken: Date[];
  target: TargetDay;
  period: Period;
  durationMinutes: number;
  timeZone: string;
  now: Date;
}

/** Devuelve los huecos libres de ese día, en orden. */
export function findSlots(search: SlotSearch): Date[] {
  const { startHour, endHour } = periodWindow(search.period);
  const takenMs = new Set(search.taken.map((d) => d.getTime()));
  const slots: Date[] = [];

  for (const rule of search.rules.filter((r) => r.weekday === search.target.weekday)) {
    const [rs, rsm] = rule.start_time.split(':').map(Number);
    const [re, rem] = rule.end_time.split(':').map(Number);

    const ruleStart = rs * 60 + rsm;
    const ruleEnd = re * 60 + rem;
    const windowStart = Math.max(ruleStart, startHour * 60);
    const windowEnd = Math.min(ruleEnd, endHour * 60);

    for (let m = windowStart; m + search.durationMinutes <= windowEnd; m += search.durationMinutes) {
      const when = zonedToUtc(
        search.target.year,
        search.target.month,
        search.target.day,
        Math.floor(m / 60),
        m % 60,
        search.timeZone,
      );

      if (when.getTime() <= search.now.getTime()) continue; // no agendar en el pasado
      if (takenMs.has(when.getTime())) continue;

      slots.push(when);
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

/** Formatea un instante en palabras, en la zona y el idioma del negocio. */
export function describeSlot(when: Date, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(when);
}
