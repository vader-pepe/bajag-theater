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

export function generateLinks(filenames: string[]): string {
  return filenames
    .map((filename) => {
      return `<a href="/replay/${filename}"><div style="color: black; width: 250px; background: #ee141f; background-image: url('img/JKT48.png'); background-position: left-center; background-size: 150px 210px; background-repeat: no-repeat; height: 150px; margin: 0;">${filename}</div></a>`;
    })
    .join("\n");
}
