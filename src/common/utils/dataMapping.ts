type Schedule = {
  title: string;
  body: string[];
};

interface YoutubeData {
  _type: string;
  ie_key: string;
  id: string;
  url?: string;
  title: string;
  description: string;
  duration: number | null;
  channel_id: string | null;
  channel: string | null;
  channel_url: string | null;
  uploader: string | null;
  uploader_id: string | null;
  uploader_url: string | null;
  thumbnails: Array<{
    url: string;
    height: number;
    width: number;
  }>;
  timestamp: number | null;
  release_timestamp: number | null;
  availability: string | null;
  concurrent_view_count: number | null;
  live_status: string;
  channel_is_verified: boolean;
  webpage_url: string;
  original_url: string;
  webpage_url_basename: string;
  webpage_url_domain: string;
  extractor: string;
  extractor_key: string;
  playlist_count: number;
  playlist: string;
  playlist_id: string;
  playlist_title: string;
  playlist_uploader: string;
  playlist_uploader_id: string;
  playlist_channel: string;
  playlist_channel_id: string;
  playlist_webpage_url: string;
  n_entries: number;
  playlist_index: number;
  __last_playlist_index: number;
  playlist_autonumber: number;
  epoch: number;
  release_year: number | null;
  is_live: boolean;
  was_live: boolean;
  _version: {
    version: string;
    current_git_head: string | null;
    release_git_head: string;
    repository: string;
  };
}

export function mapDaysToData(days: (number | null)[], data: Schedule[]): (Schedule | null)[] {
  return days.map((day) => (day !== null ? data[day - 1] : null));
}

export function formatTableData(data: (Schedule | null)[]): string {
  return data.map((item) => `<td>${item?.body.join("<br>")}</td>`).join("");
}

export function generateLinks(filenames: string[]): string {
  return filenames
    .map((filename) => {
      return `<a href="/watch/${filename}"><div style="color: black; width: 250px; background: #ee141f; background-image: url('img/JKT48.png'); background-position: left-center; background-size: 150px 210px; background-repeat: no-repeat; height: 150px; margin: 0;">${filename}</div></a>`;
    })
    .join("\n");
}

export function transformInput(input: string): YoutubeData[] {
  // Add a comma between the JSON objects
  const formattedInput = `[${input.replace(/}\s*{/g, "},{")}]`;

  // Parse the formatted JSON string
  try {
    return JSON.parse(formattedInput);
  } catch (error) {
    throw new Error("Invalid input format. Could not parse JSON.");
  }
}

export function parseNetscapeCookies(fileContent: string): string[] {
  const cookies: string[] = [];
  const lines = fileContent.split("\n");
  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const tokens = line.split("\t");
    if (tokens.length >= 7) {
      const name = tokens[5];
      const value = tokens[6];
      cookies.push(`${name}=${value}`);
    }
  }
  return cookies;
}
