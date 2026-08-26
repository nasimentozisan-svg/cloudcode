import holidayJp from "@holiday-jp/holiday_jp";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

// Server-only: holiday_jp ships a large precomputed table of every Japanese
// national holiday, so this is kept out of ScheduleCalendar's ("use client")
// bundle - callers compute the plain day numbers here and pass them down.
export function getHolidayDaysInMonth(year: number, month: number): number[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: number[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${year}-${pad(month)}-${pad(day)}`;
    if (holidayJp.isHoliday(dateKey)) days.push(day);
  }
  return days;
}
