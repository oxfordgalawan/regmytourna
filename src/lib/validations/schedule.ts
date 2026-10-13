/**
 * Tournament schedule rules. Dates are form values: `YYYY-MM-DD` for event days,
 * `YYYY-MM-DDTHH:mm` for the registration window (compared as plain strings,
 * which sort chronologically in these formats).
 */
export type ScheduleInput = {
  startDate?: string | null;
  endDate?: string | null;
  registrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
};

export type ScheduleErrors = Partial<Record<keyof ScheduleInput, string>>;

/** Last moment registration may run: the end of the tournament's first day. */
export const registrationDeadline = (startDate: string) => `${startDate}T23:59`;

export function validateSchedule(s: ScheduleInput): ScheduleErrors {
  const errors: ScheduleErrors = {};
  const start = s.startDate || "";
  const opens = s.registrationOpensAt || "";
  const closes = s.registrationClosesAt || "";

  if (start && s.endDate && s.endDate < start) {
    errors.endDate = "The last day can't be before the first day.";
  }
  if (start && opens && opens > registrationDeadline(start)) {
    errors.registrationOpensAt = "Registration has to open on or before the tournament's first day.";
  }
  if (start && closes && closes > registrationDeadline(start)) {
    errors.registrationClosesAt = "Registration has to close on or before the tournament's first day.";
  }
  if (opens && closes && closes <= opens) {
    errors.registrationClosesAt = "Registration has to close after it opens.";
  }
  return errors;
}
