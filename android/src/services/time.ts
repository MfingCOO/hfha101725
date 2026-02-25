'use client';
import { formatInTimeZone, toDate } from 'date-fns-tz';
import { format, isValid } from 'date-fns';

/**
 * Gets the user's IANA timezone identifier from their browser.
 * e.g., "America/New_York", "Europe/London".
 * @returns The user's IANA timezone string.
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Converts a "local" date string from a specific timezone into a true UTC Date object.
 * This is for taking user input (e.g., a coach's "3:00 PM" in "America/Chicago") and making it universal.
 * @param localDateString - The date and time string from the user's input (e.g., "2024-01-01T15:00:00").
 * @param timezone - The IANA timezone of the user who provided the date.
 * @returns A Date object representing the absolute time in UTC.
 */
export function convertToUTC(localDateString: string, timezone: string): Date {
  // toDate is the correct function for this. It interprets the string
  // AS IF it were in the specified timezone, and returns a universal Date object.
  return toDate(localDateString, { timeZone: timezone });
}

/**
 * Takes a UTC date (from the database) and formats it into a readable string
 * for the user in their own local timezone.
 * @param utcDate - The UTC Date object or ISO string from the database.
 * @param formatString - The desired output format (e.g., "PPP p", "MM/dd/yyyy", "p").
 * @returns A formatted date string in the user's local time.
 */
export function formatInUserTimezone(utcDate: string | Date, formatString: string): string {
  const date = new Date(utcDate);
  if (!isValid(date)) {
    // If the date is invalid, return a clear error instead of a cryptic default.
    return 'Invalid Date';
  }
  
  try {
    const userTimezone = getUserTimezone();
    // formatInTimeZone is the correct function. It takes a universal Date
    // object and displays what time that would be in a different timezone.
    return formatInTimeZone(date, userTimezone, formatString);
  } catch (error) {
    console.error("Error formatting date in user timezone:", error);
    // Fallback to a simple format, which will likely be wrong but won't crash.
    return format(date, formatString);
  }
}

/**
 * A simple formatter for displaying parts of a date without timezone conversion.
 * @param date - The Date object.
 * @param formatString - The desired output format.
 * @returns A formatted date string.
 */
export function formatDate(date: string | Date, formatString: string): string {
  return format(new Date(date), formatString);
}
