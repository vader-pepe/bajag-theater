type Schedule = {
  title: string;
  body: string[];
};

export function mapDaysToData(days: (number | null)[], data: Schedule[]): (Schedule | null)[] {
  return days.map((day) => (day !== null ? data[day - 1] : null));
}

export function formatTableData(data: (Schedule | null)[]): string {
  return data.map((item) => `<td>${item?.body.join("<br>")}</td>`).join("");
}
