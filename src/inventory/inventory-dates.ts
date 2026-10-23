import { BadRequestException } from '@nestjs/common';
import { INVENTORY_INVALID_DATE_MESSAGE } from './inventory.constants.js';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDateOnly(value: string): Date {
  const match = DATE_ONLY.exec(value);

  if (!match) {
    throw new BadRequestException(INVENTORY_INVALID_DATE_MESSAGE);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(INVENTORY_INVALID_DATE_MESSAGE);
  }

  return date;
}

export function startOfInventoryDay(now = new Date()): Date {
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  return parseDateOnly(formatted);
}

export function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function toDateOnlyString(value: Date): string {
  return value.toISOString().slice(0, 10);
}
