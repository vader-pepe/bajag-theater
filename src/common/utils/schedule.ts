import axios from "axios";
import * as cheerio from "cheerio";

interface EventForShow {
  badgeUrl: string;
  eventName: string;
  eventUrl?: string | undefined;
}

interface Event {
  bulan_tahun: string;
  tanggal: string;
  hari: string;
  badge_url?: string | undefined;
  event_name: string;
  event_time: string;
  event_id?: string | undefined;
  have_event: boolean;
}

export interface Schedule {
  showInfo: string;
  setlist: string;
  members: string[]; // Daftar anggota tanpa style
  birthday?: string[] | null;
}

export interface ParsedSchedule {
  tanggal: string;
  hari: string;
  bulan: string;
  events: EventForShow[];
}

const isValidShowInfo = (showInfo: string) => {
  const daysOfWeek = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  return daysOfWeek.some((day) => showInfo.includes(day));
};

const parseShowInfo = (showInfoFull: string) => {
  const regex = /(\w+),\s(\d{1,2}\.\d{1,2}\.\d{4})\s+Show\s(\d{1,2}:\d{2})/;
  const match = showInfoFull.match(regex);
  if (match) {
    const day = match[1];
    const date = match[2];
    const time = match[3];
    return `${day}, ${date} ${time}`;
  }
  return showInfoFull;
};

export const parseEvents = (html: string) => {
  const $ = cheerio.load(html);

  const tableBody = $("tbody");
  const rows = tableBody.find("tr");

  const bulan_tahun = $(".entry-schedule__header--center").text().trim();

  const lists = [];
  const size = rows.length;
  let x = 0;

  while (x < size) {
    const model: Event = {
      bulan_tahun: "",
      event_id: "",
      event_name: "",
      event_time: "",
      hari: "",
      have_event: false,
      tanggal: "",
      badge_url: "",
    };
    model.bulan_tahun = bulan_tahun;

    const list_td = rows.eq(x).find("td");

    const tanggal_mentah = list_td.eq(0).find("h3").text();

    const tanggal_rplc = tanggal_mentah.replace(")", "");
    const tanggal_spl = tanggal_rplc.split("(");

    if (tanggal_spl.length > 0) {
      const tanggal = tanggal_spl[0];
      // console.log('tanggal ' + tanggal);

      model.tanggal = tanggal;
    }

    if (tanggal_spl.length >= 1) {
      const hari = tanggal_spl[1];

      model.hari = hari;
    }

    const list_event = list_td.eq(1).find("div");
    const size_of_event = list_event.length;
    let position_event = 0;

    while (position_event < size_of_event) {
      const event = list_event.eq(position_event);

      const badge_span = event.find("span");
      const badge_img = badge_span.find("img");
      if (badge_img.attr("src")) {
        model.badge_url = badge_img.attr("src");
      }

      const event_name_full = event.find("p").text().trim();
      const event_name = event_name_full.slice(6);

      model.event_name = event_name;
      const event_jam = event_name_full.slice(0, 5);

      model.event_time = event_jam;

      const url_event_full = event.find("a").attr("href");
      const url_event_full_rplc = url_event_full?.replace("?lang=id", "");
      const url_event_full_rplc_2 = url_event_full_rplc?.replace("/theater/schedule/id/", "");

      model.event_id = url_event_full_rplc_2;
      model.have_event = true;

      lists.push(model);
      position_event += 1;
    }

    if (size_of_event === 0) {
      model.have_event = false;
      lists.push(model);
    }
    x += 1;
  }

  return lists;
};

export const getSchedule = async () => {
  const url = "https://jkt48.com/theater/schedule";
  try {
    const result = await axios.get<string>(url);
    return result.data;
  } catch (error) {
    return null;
  }
};

export const fetchEvents = async () => {
  const url = "https://jkt48.com/calendar/list?lang=id";

  try {
    const response = await axios.get<string>(url);
    return response.data;
  } catch (error) {
    return null;
  }
};

export const fetchScheduleSectionData = async () => {
  const url = "https://jkt48.com/";

  try {
    const response = await axios.get<string>(url);
    return response.data;
  } catch (error) {
    return null;
  }
};

// Function to map month numbers to month abbreviations
const mapMonthNumberToAbbreviation = (monthNumber: string) => {
  const monthAbbreviations = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  return monthAbbreviations[Number.parseInt(monthNumber, 10) - 1];
};

export const parseScheduleSectionData = (html: string) => {
  const $ = cheerio.load(html);
  const data: ParsedSchedule[] = [];
  const tableBody = $(".entry-schedule__calendar table tbody");
  const rows = tableBody.find("tr");

  rows.each((index, element) => {
    const row = $(element);
    const columns = row.find("td");

    const dateInfo = columns.eq(0).find("h3").text().trim();
    const [tanggal, monthNumber] = dateInfo.split("/");

    // Convert month number to month abbreviation
    const monthAbbrev = mapMonthNumberToAbbreviation(monthNumber);

    const formattedDay = dateInfo.split("(")[1].replace(")", "").trim(); // Extract and clean up the day

    const events: EventForShow[] = [];
    columns.each((index, column) => {
      if (index > 0) {
        const eventColumns = $(column).find(".contents");

        eventColumns.each((eventIndex, eventColumn) => {
          const badgeImg = $(eventColumn).find("span.badge img").attr("src");
          const eventName = $(eventColumn).find("p a").text().trim();
          const eventUrl = $(eventColumn).find("p a").attr("href");

          // Only include events with badgeUrl equal to '/images/icon.cat2.png'
          if (badgeImg === "/images/icon.cat2.png") {
            events.push({
              badgeUrl: badgeImg,
              eventName,
              eventUrl,
            });
          }
        });
      }
    });

    // Add data only if there are events that pass the filter
    if (events.length > 0) {
      data.push({
        tanggal,
        hari: formattedDay,
        bulan: monthAbbrev,
        events,
      });
    }
  });

  return data.reverse();
};

export const parseScheduleData = (html: string) => {
  const $ = cheerio.load(html);

  const table = $(".table");
  const scheduleData: Schedule[] = [];

  table.find("tbody tr").each((index, element) => {
    const showInfoFull = $(element).find("td:nth-child(1)").text().trim();
    const setlist = $(element).find("td:nth-child(2)").text().trim();

    // Ambil anggota yang tidak memiliki style
    const members = $(element)
      .find("td:nth-child(3) a:not([style])") // Ambil anggota tanpa style
      .map((i, el) => $(el).text().trim())
      .get();

    // Ambil anggota yang memiliki style
    const birthdayMembers = $(element)
      .find('td:nth-child(3) a[style="color:#616D9D"]')
      .map((i, el) => $(el).text().trim())
      .get();

    const showInfo = parseShowInfo(showInfoFull);

    if (isValidShowInfo(showInfo)) {
      if (!showInfo.includes("Penukaran tiket")) {
        scheduleData.push({
          showInfo,
          setlist,
          members, // Daftar anggota tanpa style
          birthday: birthdayMembers.length > 0 ? birthdayMembers : null, // Daftar anggota berulang tahun
        });
      }
    }
  });

  return scheduleData.reverse();
};
