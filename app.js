const DATA_URL = "data/weekly_counts.json";
const CUMULATIVE_DATA_URL = "data/cumulative_counts.json";
const OLD_AUGUST_TRACKER_URL = "data/old_august_2026_tracker.json";
const START_YEAR = 2015;
const UPCOMING_TALKS_URL = "https://raw.githubusercontent.com/louissimoncyr/louissimoncyr.github.io/upcoming-talks-content/data/upcoming-talks.md";
const UPCOMING_TALKS_FALLBACK_URL = "data/upcoming-talks.md";

const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DISCLOSURE_AUDITS = {
  7: {
    month: "August",
    categories: [
      { label: "AI use disclosed", count: 12, swatch: "ai-use", color: "var(--text)" },
      { label: "Explicit no-use statement", count: 1, swatch: "no-use", color: "var(--trend)" },
      { label: "No AI disclosure found", count: 65, swatch: "no-disclosure", color: "var(--line)" }
    ]
  },
  8: {
    month: "September",
    categories: [
      { label: "AI use disclosed", count: 34, swatch: "ai-use", color: "var(--text)" },
      { label: "Full-work no-use statement", count: 3, swatch: "no-use", color: "var(--trend)" },
      { label: "Limited no-use statement", count: 2, swatch: "limited-no-use", color: "var(--average)" },
      { label: "No AI statement found", count: 34, swatch: "no-disclosure", color: "var(--line)" }
    ]
  }
};
let aiImpactData = {
  cumulative: null,
  oldMonthRows: [],
  oldMonthIndex: 7,
  oldYear: 2026,
  selectedMonthIndex: null,
  comparisonMode: "year-to-date",
  view: "updated"
};

function upcomingTalkItems(markdown) {
  return markdown
    .replace(/<!--[\s\S]*?(?:-->|$)/g, "")
    .split(/\r?\n/)
    .map((line) => line.match(/^[-*+]\s+(.+?)\s*$/))
    .filter(Boolean)
    .map((match) => match[1])
    .slice(0, 50);
}

function appendUpcomingTalkContent(item, text) {
  const linkPattern = /\[([^\]]+)]\(([^)]+)\)/g;
  let cursor = 0;
  let match;

  while ((match = linkPattern.exec(text)) !== null) {
    item.append(document.createTextNode(text.slice(cursor, match.index)));
    try {
      const url = new URL(match[2]);
      if (!["http:", "https:", "mailto:"].includes(url.protocol)) throw new Error("Unsupported URL");
      const link = document.createElement("a");
      link.href = url.href;
      link.textContent = match[1];
      if (["http:", "https:"].includes(url.protocol)) {
        link.target = "_blank";
        link.rel = "noreferrer";
      }
      item.append(link);
    } catch (_error) {
      item.append(document.createTextNode(match[0]));
    }
    cursor = linkPattern.lastIndex;
  }

  item.append(document.createTextNode(text.slice(cursor)));
}

function renderUpcomingTalks(items) {
  const list = document.getElementById("upcoming-talks-list");
  if (!list) return;

  list.replaceChildren();
  if (!items.length) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "upcoming-talks-status";
    emptyItem.textContent = "Nothing announced yet.";
    list.append(emptyItem);
    return;
  }

  items.forEach((text) => {
    const item = document.createElement("li");
    appendUpcomingTalkContent(item, text);
    list.append(item);
  });
}

async function loadUpcomingTalks() {
  for (const url of [UPCOMING_TALKS_URL, UPCOMING_TALKS_FALLBACK_URL]) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const markdown = await response.text();
      if (new TextEncoder().encode(markdown).length > 32 * 1024) {
        throw new Error("Upcoming-talks file is too large");
      }
      renderUpcomingTalks(upcomingTalkItems(markdown));
      return;
    } catch (_error) {
      // Try the checked-in copy if the independently synced content is unavailable.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  renderUpcomingTalks([]);
}

const fallbackData = {
  updated: "2026-09-08T00:00:00+00:00",
  weeks: [
    { week: "2026-06-01", count: 12 },
    { week: "2026-06-08", count: 8 },
    { week: "2026-06-15", count: 9 },
    { week: "2026-06-22", count: 11 },
    { week: "2026-06-29", count: 10 },
    { week: "2026-07-06", count: 13 },
    { week: "2026-07-13", count: 16 },
    { week: "2026-07-20", count: 12 },
    { week: "2026-07-27", count: 14 },
    { week: "2026-08-03", count: 15 },
    { week: "2026-08-10", count: 20 },
    { week: "2026-08-17", count: 19 },
    { week: "2026-08-24", count: 13 }
  ]
};

function cssVar(name, fallback = "") {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function movingAverage(values, window = 12) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(avg);
  }
  return out;
}

function formatWeekLabel(isoWeek) {
  const d = new Date(`${isoWeek}T00:00:00Z`);
  const month = d.toLocaleDateString(undefined, { month: "short" });
  return `${month} ${d.getUTCDate()}`;
}

function parseData(payload) {
  const weeks = (payload && payload.weeks ? payload.weeks : []).slice();
  return weeks
    .map((row) => ({
      week: row.week,
      date: new Date(`${row.week}T00:00:00Z`),
      count: Number(row.count || 0)
    }))
    .filter((row) => !Number.isNaN(row.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

function addAnnualCell(row, tagName, text, options = {}) {
  const cell = document.createElement(tagName);
  cell.textContent = text;
  if (options.scope) cell.scope = options.scope;
  if (options.className) cell.className = options.className;
  if (options.title) cell.title = options.title;
  row.appendChild(cell);
}

function parseMonthlyData(payload) {
  const months = (payload && payload.months ? payload.months : []).slice();
  return months
    .map((row) => ({
      month: row.month,
      date: new Date(`${row.month}-01T00:00:00Z`),
      count: Number(row.count || 0)
    }))
    .filter((row) => !Number.isNaN(row.date.getTime()))
    .sort((a, b) => a.date - b.date);
}

function monthlyRowsFromWeeks(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    const key = row.week.slice(0, 7);
    totals.set(key, (totals.get(key) || 0) + row.count);
  });
  return [...totals.entries()]
    .map(([month, count]) => ({
      month,
      date: new Date(`${month}-01T00:00:00Z`),
      count
    }))
    .sort((a, b) => a.date - b.date);
}

function fullMonthName(monthIndex) {
  return new Intl.DateTimeFormat(undefined, { month: "long", timeZone: "UTC" })
    .format(new Date(Date.UTC(2000, monthIndex, 1)));
}

function monthComparisonRows(monthRows, monthIndex, finalYear) {
  return monthRows.filter((row) => (
    row.date.getUTCFullYear() >= START_YEAR
    && row.date.getUTCFullYear() <= finalYear
    && row.date.getUTCMonth() === monthIndex
  ));
}

function yearComparisonRows(monthRows) {
  const latest = monthRows[monthRows.length - 1];
  if (!latest) return { rows: [], lastMonthIndex: 11, currentYearIsPartial: false };

  const firstYear = Math.max(START_YEAR, monthRows[0].date.getUTCFullYear());
  const lastYear = latest.date.getUTCFullYear();
  const lastMonthIndex = latest.date.getUTCMonth();
  const countsByMonth = new Map(monthRows.map((row) => [
    `${row.date.getUTCFullYear()}-${row.date.getUTCMonth()}`,
    row.count
  ]));
  const totalThrough = (year, monthIndex) => {
    let total = 0;
    for (let month = 0; month <= monthIndex; month++) {
      total += countsByMonth.get(`${year}-${month}`) || 0;
    }
    return total;
  };

  const rows = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const partial = year === lastYear && lastMonthIndex < 11;
    const throughMonthIndex = partial ? lastMonthIndex : 11;
    rows.push({
      date: new Date(Date.UTC(year, 0, 1)),
      count: totalThrough(year, throughMonthIndex),
      previousCount: totalThrough(year - 1, throughMonthIndex),
      partial,
      throughMonthIndex
    });
  }

  return {
    rows,
    lastMonthIndex,
    currentYearIsPartial: lastMonthIndex < 11
  };
}

function renderPeriodComparisonChart(canvas, rows, yAxisLabel) {
  if (!canvas || !rows.length) return;

  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.max(320, Math.round(rect.width));
  const height = Math.max(260, Math.round(rect.height));
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const pad = { left: 62, right: 24, top: 24, bottom: 70 };
  const xFrom = pad.left;
  const xTo = width - pad.right;
  const yFrom = height - pad.bottom;
  const yTo = pad.top;
  const values = rows.map((row) => row.count);
  const yTicks = 5;
  const yStep = Math.max(1, Math.ceil(Math.max(...values, 1) / yTicks));
  const maxVal = yStep * yTicks;
  const barBand = (xTo - xFrom) / rows.length;
  const barWidth = Math.max(14, Math.min(68, barBand * 0.62));
  const muted = cssVar("--muted", "#78614d");
  const gridColor = cssVar("--line", "#dfbf8d");

  function yAt(value) {
    return yTo + (1 - value / maxVal) * (yFrom - yTo);
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = cssVar("--surface", "#fff0d8");
  ctx.fillRect(0, 0, width, height);
  ctx.font = "16px serif";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= yTicks; i++) {
    const value = maxVal - i * yStep;
    const y = yAt(value);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(xFrom, y);
    ctx.lineTo(xTo, y);
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.textAlign = "right";
    ctx.fillText(String(value), xFrom - 10, y);
  }

  rows.forEach((row, index) => {
    const x = xFrom + barBand * index + (barBand - barWidth) / 2;
    const y = yAt(row.count);
    ctx.fillStyle = "#000000";
    ctx.fillRect(x, y, barWidth, yFrom - y);
    ctx.fillStyle = muted;
    ctx.save();
    ctx.translate(x + barWidth / 2, yFrom + 11);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(row.date.getUTCFullYear()), 0, 0);
    ctx.restore();
  });

  ctx.strokeStyle = muted;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(xFrom, yTo);
  ctx.lineTo(xFrom, yFrom);
  ctx.lineTo(xTo, yFrom);
  ctx.stroke();

  ctx.fillStyle = muted;
  ctx.font = "16px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Year", (xFrom + xTo) / 2, height - 10);
  ctx.save();
  ctx.translate(15, (yTo + yFrom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yAxisLabel, 0, 0);
  ctx.restore();
}

function percentageChange(current, previous) {
  if (!previous) return { value: null, text: "—" };
  const value = (current - previous) / previous;
  return {
    value,
    text: `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`
  };
}

function renderAiComparisonTable(rows, options) {
  const targetIds = options.targetIds || {};
  const yearsRow = document.getElementById(targetIds.years || "ai-years");
  const countsRow = document.getElementById(targetIds.counts || "ai-counts");
  const changesRow = document.getElementById(targetIds.changes || "ai-changes");
  const caption = document.getElementById(targetIds.caption || "ai-caption");
  const note = document.getElementById(targetIds.note || "ai-comparison-note");
  if (!rows.length || !yearsRow || !countsRow || !changesRow || !caption || !note) return;

  yearsRow.replaceChildren();
  countsRow.replaceChildren();
  changesRow.replaceChildren();
  addAnnualCell(yearsRow, "th", "Year", { scope: "col" });
  addAnnualCell(countsRow, "th", options.countLabel, { scope: "row" });
  addAnnualCell(changesRow, "th", "Change from prior year", { scope: "row" });

  (options.reverseYears ? rows.slice().reverse() : rows).forEach((row) => {
    const year = row.date.getUTCFullYear();
    const { value: change, text: changeText } = percentageChange(row.count, options.previousFor(row));
    const currentPartial = Boolean(row.partial);
    const changeClass = [
      currentPartial ? "current-year" : "",
      change !== null && change > 0 ? "positive" : "",
      change !== null && change < 0 ? "negative" : ""
    ].filter(Boolean).join(" ");
    const yearLabel = currentPartial ? `${year} YTD` : String(year);

    addAnnualCell(yearsRow, "th", yearLabel, {
      scope: "col",
      className: currentPartial ? "current-year" : ""
    });
    addAnnualCell(countsRow, "td", row.count.toLocaleString(), {
      className: currentPartial ? "current-year" : ""
    });
    addAnnualCell(changesRow, "td", changeText, {
      className: changeClass,
      title: change === null ? "No prior-year comparison is available" : options.comparisonLabel(row)
    });
  });

  caption.textContent = options.caption;
  note.textContent = options.note;
}

function selectedAiPeriod() {
  const selected = document.querySelector('input[name="ai-period"]:checked');
  return selected?.value === "year" ? "year" : "month";
}

function syncAiPeriodSwitch() {
  const switcher = document.getElementById("ai-period-switch");
  if (switcher) switcher.dataset.selected = selectedAiPeriod();
}

function setupAiPeriodSwitch() {
  const switcher = document.getElementById("ai-period-switch");
  if (!switcher || switcher.dataset.bound === "true") return;

  switcher.dataset.bound = "true";
  syncAiPeriodSwitch();
  switcher.addEventListener("change", (event) => {
    if (!event.target.matches('input[name="ai-period"]')) return;
    syncAiPeriodSwitch();
    renderTracker();
  });
}

function renderOldTracker() {
  const monthRows = aiImpactData.oldMonthRows;
  const canvas = document.getElementById("ai-impact-chart");
  const context = document.getElementById("ai-month-context");
  if (!canvas || !context || !monthRows.length) return;

  syncAiPeriodSwitch();
  if (selectedAiPeriod() === "year") {
    const { rows, lastMonthIndex, currentYearIsPartial } = yearComparisonRows(monthRows);
    if (!rows.length) return;

    const firstYear = rows[0].date.getUTCFullYear();
    const lastYear = rows[rows.length - 1].date.getUTCFullYear();
    const lastMonth = fullMonthName(lastMonthIndex);
    context.textContent = currentYearIsPartial
      ? `Old August 2026 tracker. Annual first-version paper totals; ${lastYear} is shown through ${lastMonth}.`
      : "Old August 2026 tracker. Annual first-version paper totals.";
    canvas.setAttribute("aria-label", currentYearIsPartial
      ? `Annual paper totals from ${firstYear} through ${lastYear}; ${lastYear} is year to date through ${lastMonth}. The horizontal axis is year and the vertical axis is the number of papers.`
      : `Annual paper totals from ${firstYear} through ${lastYear}. The horizontal axis is year and the vertical axis is the number of papers.`);
    renderPeriodComparisonChart(canvas, rows, "Papers per year");
    renderAiComparisonTable(rows, {
      caption: `First-version ${"math.SG"} papers grouped by year`,
      countLabel: "Papers",
      note: currentYearIsPartial
        ? `For completed years, each percentage compares the full calendar year with the preceding one. ${lastYear} is counted only from January through ${lastMonth}, so its percentage compares January–${lastMonth} ${lastYear} with the same months in ${lastYear - 1}.`
        : "Each percentage compares one full calendar year with the preceding full calendar year.",
      previousFor: (row) => row.previousCount,
      comparisonLabel: (row) => {
        const year = row.date.getUTCFullYear();
        return row.partial
          ? `Compared with January through ${fullMonthName(row.throughMonthIndex)} ${year - 1}`
          : `Compared with ${year - 1}`;
      }
    });
    return;
  }

  const monthIndex = aiImpactData.oldMonthIndex;
  const monthLabel = fullMonthName(monthIndex);
  const rows = monthComparisonRows(monthRows, monthIndex, aiImpactData.oldYear);
  if (!rows.length) {
    context.textContent = `No ${monthLabel} data is available yet.`;
    return;
  }

  const firstYear = rows[0].date.getUTCFullYear();
  const lastYear = rows[rows.length - 1].date.getUTCFullYear();
  context.textContent = `Old August 2026 tracker. First-version papers posted on arXiv in ${monthLabel} with the math.SG tag each year.`;
  canvas.setAttribute("aria-label", `Paper counts in ${monthLabel} from ${firstYear} through ${lastYear}. The horizontal axis is year and the vertical axis is the number of papers.`);
  renderPeriodComparisonChart(canvas, rows, `Papers in ${monthLabel}`);
  const allValues = new Map(
    monthRows
      .filter((row) => row.date.getUTCMonth() === monthIndex)
      .map((row) => [row.date.getUTCFullYear(), row.count])
  );
  renderAiComparisonTable(rows, {
    caption: `First-version papers posted on Arxiv in ${monthLabel} with the math.SG tag each year.`,
    countLabel: `Papers in ${monthLabel}`,
    note: `Each percentage compares ${monthLabel} with ${monthLabel} in the preceding year.`,
    previousFor: (row) => allValues.get(row.date.getUTCFullYear() - 1),
    comparisonLabel: (row) => `Compared with ${monthLabel} ${row.date.getUTCFullYear() - 1}`
  });
}

function parseCumulativeData(payload) {
  const cutoff = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(payload?.last_completed_month || "");
  if (!cutoff || !Array.isArray(payload.years)) throw new Error("Invalid cumulative tracker data");

  const latestYear = Number(cutoff[1]);
  const latestMonthIndex = Number(cutoff[2]) - 1;
  const countsByYear = new Map(payload.years.map((row) => [Number(row.year), row.cumulative]));
  for (let year = START_YEAR; year <= latestYear; year++) {
    const counts = countsByYear.get(year);
    if (!Array.isArray(counts) || counts.length <= latestMonthIndex
      || counts.slice(0, latestMonthIndex + 1).some((count) => !Number.isInteger(count) || count < 0)) {
      throw new Error(`Missing cumulative tracker data for ${year}`);
    }
  }

  return { latestYear, latestMonthIndex, countsByYear };
}

function cumulativeComparisonRows(monthIndex) {
  const { cumulative } = aiImpactData;
  const rows = [];
  for (let year = START_YEAR; year <= cumulative.latestYear; year++) {
    rows.push({
      date: new Date(Date.UTC(year, 0, 1)),
      count: cumulative.countsByYear.get(year)[monthIndex]
    });
  }
  return rows;
}

function monthlyComparisonRowsFromCumulative(monthIndex) {
  const { cumulative } = aiImpactData;
  const rows = [];
  for (let year = START_YEAR; year <= cumulative.latestYear; year++) {
    const counts = cumulative.countsByYear.get(year);
    rows.push({
      date: new Date(Date.UTC(year, monthIndex, 1)),
      count: counts[monthIndex] - (monthIndex === 0 ? 0 : counts[monthIndex - 1])
    });
  }
  return rows;
}

function renderUpdatedMonthlyComparison() {
  const canvas = document.getElementById("monthly-impact-chart");
  const context = document.getElementById("monthly-month-context");
  if (!canvas || !context) return;

  const monthIndex = aiImpactData.selectedMonthIndex;
  const monthLabel = fullMonthName(monthIndex);
  const rows = monthlyComparisonRowsFromCumulative(monthIndex);
  const countsByYear = new Map(rows.map((row) => [row.date.getUTCFullYear(), row.count]));
  const axisLabel = `Papers in ${monthLabel}`;

  context.textContent = `First-version math.SG papers posted on arXiv in ${monthLabel} of each year.`;
  canvas.setAttribute("aria-label", `Paper counts in ${monthLabel}, ${START_YEAR}–${aiImpactData.cumulative.latestYear}. The horizontal axis is year and the vertical axis is the number of papers in ${monthLabel}.`);
  renderPeriodComparisonChart(canvas, rows, axisLabel);
  renderAiComparisonTable(rows, {
    reverseYears: true,
    targetIds: {
      years: "monthly-years",
      counts: "monthly-counts",
      changes: "monthly-changes",
      caption: "monthly-caption",
      note: "monthly-comparison-note"
    },
    caption: `Papers in ${monthLabel}, by year.`,
    countLabel: axisLabel,
    note: `Each percentage compares ${monthLabel} with ${monthLabel} in the preceding year.`,
    previousFor: (row) => countsByYear.get(row.date.getUTCFullYear() - 1),
    comparisonLabel: (row) => `Compared with ${monthLabel} ${row.date.getUTCFullYear() - 1}`
  });
}

function renderUpdatedTracker() {
  if (aiImpactData.comparisonMode === "monthly") {
    renderUpdatedMonthlyComparison();
    return;
  }

  const canvas = document.getElementById("ai-impact-chart");
  const context = document.getElementById("ai-month-context");
  const monthIndex = aiImpactData.selectedMonthIndex;
  const monthLabel = fullMonthName(monthIndex);
  const period = monthIndex === 0 ? "in January" : `from January through ${monthLabel}`;
  const rows = cumulativeComparisonRows(monthIndex);
  const totalsByYear = new Map(rows.map((row) => [row.date.getUTCFullYear(), row.count]));
  const axisLabel = monthIndex === 0 ? "Papers in January" : `Papers through ${monthLabel}`;

  context.textContent = `First-version math.SG papers posted on arXiv ${period} each year.`;
  canvas.setAttribute("aria-label", `Paper totals ${period}, ${START_YEAR}–${aiImpactData.cumulative.latestYear}. The horizontal axis is year and the vertical axis is the number of papers ${period}.`);
  renderPeriodComparisonChart(canvas, rows, axisLabel);
  renderAiComparisonTable(rows, {
    reverseYears: true,
    caption: `Totals ${period}, by year.`,
    countLabel: axisLabel,
    note: monthIndex === 0
      ? "Each percentage compares January with January in the preceding year."
      : `Each percentage compares January through ${monthLabel} with the same months in the preceding year.`,
    previousFor: (row) => totalsByYear.get(row.date.getUTCFullYear() - 1),
    comparisonLabel: (row) => monthIndex === 0
      ? `Compared with January ${row.date.getUTCFullYear() - 1}`
      : `Compared with January through ${monthLabel} ${row.date.getUTCFullYear() - 1}`
  });
}

function renderDisclosureSummary() {
  const section = document.getElementById("ai-disclosure-summary");
  const audit = aiImpactData.view === "updated"
    ? DISCLOSURE_AUDITS[aiImpactData.selectedMonthIndex] : null;
  section.hidden = !audit;
  if (!audit) return;

  const total = audit.categories.reduce((sum, category) => sum + category.count, 0);
  document.getElementById("ai-disclosure-summary-title").textContent = `AI disclosure in ${audit.month} 2026`;
  document.getElementById("ai-disclosure-summary-description").textContent =
    `Disclosure status for ${total} math.SG papers first submitted in ${audit.month} 2026.`;
  document.getElementById("ai-disclosure-summary-link").href =
    `ai-disclosure-data.html#${audit.month.toLowerCase()}-2026`;

  let start = 0;
  const stops = audit.categories.map((category, index) => {
    const end = index === audit.categories.length - 1
      ? 100 : start + category.count / total * 100;
    const stop = `${category.color} ${start.toFixed(4)}% ${end.toFixed(4)}%`;
    start = end;
    return stop;
  });
  const pie = document.getElementById("ai-disclosure-summary-pie");
  pie.style.backgroundImage = `conic-gradient(${stops.join(", ")})`;
  pie.setAttribute("aria-label", `${audit.month} 2026 AI disclosure: ${audit.categories
    .map((category) => `${category.label}, ${category.count}`)
    .join("; ")}.`);

  const legend = document.getElementById("ai-disclosure-summary-legend");
  legend.replaceChildren(...audit.categories.map((category) => {
    const item = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = `ai-disclosure-swatch ${category.swatch}`;
    swatch.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.textContent = `${category.label}: ${category.count} (${(category.count / total * 100).toFixed(1)}%)`;
    item.append(swatch, label);
    return item;
  }));
}

function renderTracker() {
  if (!aiImpactData.cumulative || !aiImpactData.oldMonthRows.length) return;
  const oldView = aiImpactData.view === "old";
  const monthlyMode = !oldView && aiImpactData.comparisonMode === "monthly";
  document.getElementById("updated-month-picker").hidden = oldView;
  document.getElementById("year-to-date-tracker").hidden = monthlyMode;
  document.getElementById("monthly-tracker").hidden = !monthlyMode;
  const modeSwitch = document.getElementById("tracker-mode-switch");
  modeSwitch.hidden = oldView;
  modeSwitch.textContent = monthlyMode
    ? "Switch to year-to-date comparison" : "Switch to month-by-month comparison";
  document.getElementById("ai-tools").hidden = !oldView;
  document.getElementById("ai-comparison-note").hidden = !oldView;
  document.getElementById("ai-period-switch").hidden = !oldView;
  document.querySelectorAll(".month-option").forEach((button) => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.monthIndex) === aiImpactData.selectedMonthIndex));
  });
  if (oldView) renderOldTracker();
  else renderUpdatedTracker();
  renderDisclosureSummary();
}

function setupTrackerControls() {
  const options = document.getElementById("month-options");
  options.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-month-index]");
    if (!button || !options.contains(button)) return;
    aiImpactData.selectedMonthIndex = Number(button.dataset.monthIndex);
    renderTracker();
  });

  document.getElementById("tracker-mode-switch").addEventListener("click", () => {
    aiImpactData.comparisonMode = aiImpactData.comparisonMode === "monthly"
      ? "year-to-date" : "monthly";
    renderTracker();
  });
}

function renderMonthOptions() {
  const options = document.getElementById("month-options");
  options.replaceChildren();
  for (let monthIndex = 0; monthIndex <= aiImpactData.cumulative.latestMonthIndex; monthIndex++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "month-option";
    button.dataset.monthIndex = String(monthIndex);
    button.textContent = SHORT_MONTH_NAMES[monthIndex];
    button.setAttribute("aria-label", `Show ${fullMonthName(monthIndex)} in the selected comparison`);
    options.append(button);
  }
}

async function loadTrackerData() {
  try {
    const [cumulativePayload, oldPayload] = await Promise.all(
      [CUMULATIVE_DATA_URL, OLD_AUGUST_TRACKER_URL].map(async (url) => {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
    );
    const oldMonthRows = parseMonthlyData(oldPayload);
    const archiveDate = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(oldPayload?.as_of_month || "");
    if (!archiveDate || oldMonthRows.at(-1)?.month !== oldPayload.as_of_month) {
      throw new Error("Invalid old tracker data");
    }

    aiImpactData.cumulative = parseCumulativeData(cumulativePayload);
    aiImpactData.oldMonthRows = oldMonthRows;
    aiImpactData.oldYear = Number(archiveDate[1]);
    aiImpactData.oldMonthIndex = Number(archiveDate[2]) - 1;
    aiImpactData.selectedMonthIndex = aiImpactData.cumulative.latestMonthIndex;
    setupAiPeriodSwitch();
    setupTrackerControls();
    renderMonthOptions();
    renderTracker();
  } catch (_error) {
    document.getElementById("ai-month-context").textContent = "Tracker data is unavailable right now.";
    document.getElementById("updated-month-picker").hidden = true;
    document.getElementById("tracker-mode-switch").hidden = true;
  }
}

function renderTrend(canvas, rows) {
  const visible = rows.filter((row) => row.date.getUTCFullYear() >= START_YEAR);
  if (!canvas || !visible.length) return;

  const latest = visible[visible.length - 1]?.date.toLocaleDateString();
  const ctx = canvas.getContext("2d");
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.max(320, rect.width) * dpr;
  canvas.height = Math.max(300, rect.height) * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const pad = { left: 44, right: 16, top: 14, bottom: 28 };

  const values = visible.map((r) => r.count);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = cssVar("--surface", "#fff0d8");
  ctx.fillRect(0, 0, width, height);

  const lineClr = cssVar("--accent", "#bd651b");
  const gridClr = cssVar("--line", "#dfbf8d");

  const xFrom = pad.left;
  const xTo = width - pad.right;
  const yFrom = height - pad.bottom;
  const yTo = pad.top;

  function xAt(i) {
    return xFrom + (i / (visible.length - 1 || 1)) * (xTo - xFrom);
  }

  function yAt(v) {
    return yTo + (1 - (v - minVal) / (maxVal - minVal || 1)) * (yFrom - yTo);
  }

  ctx.strokeStyle = gridClr;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 5; i++) {
    const y = yTo + ((yFrom - yTo) * i) / 5;
    ctx.beginPath();
    ctx.moveTo(xFrom, y);
    ctx.lineTo(xTo, y);
    ctx.stroke();
  }

  ctx.fillStyle = cssVar("--muted", "#78614d");
  ctx.font = "16px serif";
  for (let i = 0; i <= 5; i++) {
    const value = maxVal - ((maxVal - minVal) * i) / 5;
    const y = yTo + ((yFrom - yTo) * i) / 5;
    const label = `${Math.round(value)}`;
    ctx.fillText(label, 8, y + 4);
  }

  ctx.fillStyle = cssVar("--accent-soft", "rgba(239, 189, 114, 0.32)");
  ctx.beginPath();
  ctx.moveTo(xAt(0), yFrom);
  visible.forEach((row, i) => {
    ctx.lineTo(xAt(i), yAt(row.count));
  });
  ctx.lineTo(xAt(visible.length - 1), yFrom);
  ctx.closePath();
  ctx.globalAlpha = 0.3;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = lineClr;
  ctx.lineWidth = 2;
  ctx.beginPath();
  visible.forEach((row, i) => {
    const x = xAt(i);
    const y = yAt(row.count);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  const avgVisible = movingAverage(visible.map((row) => row.count), 12);

  const avgLine = cssVar("--average", "#ca7526");
  const avgLineRgba = avgLine.length === 7
    ? `rgba(${parseInt(avgLine.slice(1, 3), 16)}, ${parseInt(avgLine.slice(3, 5), 16)}, ${parseInt(avgLine.slice(5, 7), 16)}, 0.95)`
    : avgLine;
  ctx.strokeStyle = avgLineRgba;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  avgVisible.forEach((v, i) => {
    const x = xAt(i);
    const y = yAt(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.setLineDash([]);

  const start = new Date(visible[0].week + "T00:00:00Z");
  const end = new Date(visible[visible.length - 1].week + "T00:00:00Z");
  ctx.fillText(`Weeks ${formatWeekLabel(start.toISOString().slice(0, 10))} to ${formatWeekLabel(end.toISOString().slice(0, 10))}`, xFrom + 2, 20);

  if (latest) {
    document.getElementById("trend-caption").textContent =
      `Displayed ${visible.length} weeks from ${START_YEAR} • latest: ${visible[visible.length - 1].count} papers (week of ${latest})`;
  }
}

function updateSummary(rows, payloadUpdated) {
  const total = rows.length;
  if (total === 0) return;
  const last = rows[rows.length - 1];
  const avg52 = rows.slice(-52).reduce((a, b) => a + b.count, 0) / Math.min(rows.length, 52);
  const bestIndex = rows.reduce((best, cur, idx, arr) => (cur.count > arr[best].count ? idx : best), 0);
  const best = rows[bestIndex];

  const set = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  set("total-weeks", String(total));
  set("latest-week", formatWeekLabel(last.week));
  set("latest-count", String(last.count));
  set("avg52", Number(avg52).toFixed(1));
  set("best-week", `${best.week} (${best.count})`);
  set("last-updated", payloadUpdated ? new Date(payloadUpdated).toLocaleString() : "not provided");
  const canvas = document.getElementById("trend-chart");
  if (canvas) renderTrend(canvas, rows);
}

function summarizeAndRender(payload, forceFallback = false) {
  const rows = parseData(payload);
  const safeRows = rows.length ? rows : parseData(fallbackData);

  updateSummary(safeRows, payload && payload.updated ? payload.updated : fallbackData.updated);

  if (rows.length !== safeRows.length && forceFallback) {
    const note = document.getElementById("trend-caption");
    if (note) note.textContent = "Loaded fallback data because live data file was unavailable.";
  }
}

async function run() {
  try {
    const response = await fetch(DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    summarizeAndRender(payload);
  } catch (_error) {
    summarizeAndRender(fallbackData, true);
  }
}

run();
loadTrackerData();
loadUpcomingTalks();
