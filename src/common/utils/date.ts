export function getWeekDates(): Date[] {
  const currentDate = new Date();
  const dayOfWeek = currentDate.getDay(); // 0 (Sunday) to 6 (Saturday)

  // Calculate the start of the week (Sunday)
  const sunday = new Date(currentDate);
  sunday.setDate(currentDate.getDate() - dayOfWeek);

  // Generate all days from Sunday to Saturday
  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    weekDates.push(date);
  }

  return weekDates;
}

export function getDaysForCurrentWeek(date: Date | null = null) {
  let inputDate = new Date();
  if (date) inputDate = new Date(date);
  const dayOfWeek = inputDate.getDay(); // Day of the week (0: Sunday, ..., 6: Saturday)
  const currentMonth = inputDate.getMonth(); // Current month (0: January, ..., 11: December)

  // Get Sunday (start of the week)
  const sunday = new Date(inputDate);
  sunday.setDate(inputDate.getDate() - dayOfWeek);

  // Generate all days of the week
  const days: Array<number | null> = [];
  for (let i = 0; i <= 6; i++) {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + i);
    days.push(date.getMonth() === currentMonth ? date.getDate() : null);
  }

  return days;
}
