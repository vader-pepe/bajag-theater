import jsdom from "jsdom";

const { JSDOM } = jsdom;

export function removeWhitespaceAndNewlines(input: string): string {
  return input.replace(/^\s+|\s+$/g, ""); // Replaces all whitespace and newline characters with an empty string
}

export function findClosingDiv(html: string, startIndex: number): number {
  let stack = 1; // Start with 1 since we've already encountered the opening tag
  let i = startIndex;

  while (i < html.length) {
    // Match opening and closing div tags
    const openTag = html.slice(i).match(/<div\b/);
    const closeTag = html.slice(i).match(/<\/div>/);

    const nextOpen = openTag ? i + openTag.index! : Number.POSITIVE_INFINITY;
    const nextClose = closeTag ? i + closeTag.index! : Number.POSITIVE_INFINITY;

    if (nextClose < nextOpen) {
      stack--; // Found a closing tag
      i = nextClose + 6; // Advance past `</div>`
    } else if (nextOpen < nextClose) {
      stack++; // Found an opening tag
      i = nextOpen + 4; // Advance past `<div`
    } else {
      break; // No more tags
    }

    // If the stack is balanced, we've found the closing tag
    if (stack === 0) {
      return i;
    }
  }

  return -1; // Closing tag not found
}

// Function to parse the schedule from HTML
export function parseSchedule(html: string) {
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const table = document.querySelector(".entry-schedule__calendar");

  const rows = table!.querySelectorAll("tr");
  const rowsArray = Array.from(rows);

  const extractedSchedules = rowsArray.map((row) => {
    return {
      title: removeWhitespaceAndNewlines(row.querySelectorAll("td")[0].textContent || ""),
      body: Array.from(row.querySelectorAll("td")[1].querySelectorAll(".contents")).map((x) =>
        removeWhitespaceAndNewlines(x.textContent || ""),
      ),
    };
  });

  return extractedSchedules;
}

export function findAndExtractUsingRegex(html: string) {
  // Find the starting point of the target div
  const startRegex = /<div\s+class=["']entry-schedule__calendar["'].*?>/;
  const startMatch = startRegex.exec(html);
  if (!startMatch) {
    return ""; // No matching div found
  }

  const startIndex = startMatch.index;
  const endIndex = findClosingDiv(html, startIndex + startMatch[0].length);

  if (endIndex !== -1) {
    return html.substring(startIndex, endIndex);
  }

  return ""; // Closing tag not found
}
