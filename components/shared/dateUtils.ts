type DateFormatKind = "datetime" | "date" | "time" | "short" | "shortdatetime" | "daymonth" | "relative";

let _cachedTZ = "America/Mexico_City";

export function setSystemTimezone(tz: string) {
  if (tz) _cachedTZ = tz;
}

function getTZ() {
  return _cachedTZ;
}

export function formatCDMX(date: Date | string, format: DateFormatKind = "datetime", tz?: string): string {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const options = { timeZone: tz || getTZ() };

  switch (format) {
    case "date":
      return parsedDate.toLocaleDateString("es-MX", { ...options, day: "2-digit", month: "2-digit", year: "numeric" });
    case "time":
      return parsedDate.toLocaleTimeString("es-MX", { ...options, hour: "2-digit", minute: "2-digit" });
    case "datetime":
      return parsedDate.toLocaleString("es-MX", { ...options, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    case "short":
      return parsedDate.toLocaleDateString("es-MX", { ...options, day: "2-digit", month: "2-digit", year: "2-digit" });
    case "shortdatetime":
      return parsedDate.toLocaleString("es-MX", { ...options, day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
    case "daymonth":
      return parsedDate.toLocaleDateString("es-MX", { ...options, day: "2-digit", month: "2-digit" });
    case "relative": {
      const now = Date.now();
      const diff = now - parsedDate.getTime();

      if (diff < 60000) return "Ahora";
      if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} min`;
      if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} h`;
      if (diff < 604800000) return `Hace ${Math.floor(diff / 86400000)} días`;
      return formatCDMX(date, "date", tz);
    }
    default:
      return parsedDate.toLocaleString("es-MX", { ...options, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
}

export function nowCDMX() {
  return toSystemISO(new Date());
}

export function futureCDMX(msFromNow: number) {
  return toSystemISO(new Date(Date.now() + msFromNow));
}

function toSystemISO(date: Date) {
  const tz = getTZ();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  const second = parts.find((part) => part.type === "second")?.value || "00";
  const offset = getTimezoneOffsetStr(tz, date);

  return `${year}-${month}-${day}T${hour}:${minute}:${second}${offset}`;
}

export function formatStoredLocal(date: Date | string, format: DateFormatKind = "datetime") {
  if (!date) return "";

  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime())) return "";

  const correctedDate = new Date(parsedDate.getTime() + 6 * 3600 * 1000);
  return formatCDMX(correctedDate, format);
}

export function todayCDMX() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: getTZ(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";

  return `${year}-${month}-${day}`;
}

export function startOfDayCDMX(dateStr: string) {
  return localDateTimeToUTC(dateStr, "00:00:00", getTZ());
}

export function endOfDayCDMX(dateStr: string) {
  return localDateTimeToUTC(dateStr, "23:59:59", getTZ());
}

export function systemLocalToISO(localDateTime: string) {
  if (!localDateTime || !localDateTime.includes("T")) return "";
  const [datePart, timePartRaw] = localDateTime.split("T");
  const timePart = timePartRaw.length === 5 ? `${timePartRaw}:00` : timePartRaw;
  return localDateTimeToUTC(datePart, timePart, getTZ()).toISOString();
}

function localDateTimeToUTC(dateStr: string, timeStr: string, timezone: string) {
  const utcNaive = new Date(`${dateStr}T${timeStr}Z`);
  const timezoneOffsetMs = getTimezoneOffsetMs(timezone, utcNaive);
  return new Date(utcNaive.getTime() - timezoneOffsetMs);
}

function getTimezoneOffsetMs(timezone: string, referenceDate: Date) {
  try {
    const utcString = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(referenceDate);

    const timezoneString = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(referenceDate);

    const parseFormattedString = (value: string) => {
      const cleaned = value.replace(",", "");
      return new Date(cleaned.replace(" ", "T") + "Z").getTime();
    };

    return parseFormattedString(timezoneString) - parseFormattedString(utcString);
  } catch {
    return -6 * 3600 * 1000;
  }
}

export function isInDayCDMX(date: Date | string, dateStr: string) {
  const parsedDate = new Date(date);
  return parsedDate >= startOfDayCDMX(dateStr) && parsedDate <= endOfDayCDMX(dateStr);
}

/**
 * Helper: returns UTC offset string like "-06:00" for a given timezone and reference date
 */
function getTimezoneOffsetStr(tz: string, refDate: Date) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, timeZoneName: "shortOffset"
    }).formatToParts(refDate);
    const tzPart = parts.find(p => p.type === "timeZoneName")?.value || "GMT-6";
    const match = tzPart.match(/GMT([+-]\d+)(?::(\d+))?/);
    if (!match) return "-06:00";
    const h = parseInt(match[1]);
    const m = parseInt(match[2] || "0");
    const sign = h >= 0 ? "+" : "-";
    return `${sign}${String(Math.abs(h)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } catch {
    return "-06:00";
  }
}