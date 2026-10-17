const STORAGE_KEY = "mood-garden-entries";

const moods = {
  happy: { name: "開心", icon: "☀️", plant: "🌻", color: "#e9bd69" },
  calm: { name: "平靜", icon: "🌿", plant: "🌱", color: "#7fb19d" },
  anxious: { name: "焦慮", icon: "🌀", plant: "🌾", color: "#aaa1c8" },
  low: { name: "低落", icon: "☂️", plant: "💠", color: "#83a8c5" },
  excited: { name: "期待", icon: "✨", plant: "🌷", color: "#df9eae" },
};

let entries = loadEntries();
let selectedMood = null;
let calendarView = "week";
let calendarOffset = 0;
let gardenFilter = "all";

const $ = (selector) => document.querySelector(selector);
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEntries() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderMoodOptions() {
  $("#moodOptions").innerHTML = Object.entries(moods).map(([key, mood]) => `
    <button class="mood-option${selectedMood === key ? " selected" : ""}" style="--mood:${mood.color}" data-mood="${key}" role="radio" aria-checked="${selectedMood === key}" type="button">
      <span class="mood-icon">${mood.icon}</span><span class="mood-name">${mood.name}</span>
    </button>
  `).join("");
}

function renderGarden() {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const visibleEntries = gardenFilter === "all" ? sorted : sorted.filter((entry) => entry.mood === gardenFilter);
  $("#gardenCount").textContent = sorted.length;
  $("#emptyGarden").style.display = visibleEntries.length ? "none" : "block";
  $("#gardenStage").querySelectorAll(".plant").forEach((plant) => plant.remove());
  visibleEntries.forEach((entry) => {
    const mood = moods[entry.mood];
    const plant = document.createElement("button");
    plant.className = "plant";
    plant.type = "button";
    plant.dataset.date = entry.date;
    plant.title = `${entry.date} | ${mood.name}${entry.note ? `: ${entry.note}` : ""}`;
    plant.innerHTML = `<span class="plant-emoji">${mood.plant}</span><span class="plant-date">${entry.date.slice(5).replace("-", "/")}</span>`;
    $("#gardenStage").appendChild(plant);
  });

  const counts = entries.reduce((all, entry) => ({ ...all, [entry.mood]: (all[entry.mood] || 0) + 1 }), {});
  const favorite = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  $("#streakStat").textContent = entries.length;
  $("#favoriteStat").textContent = favorite ? moods[favorite[0]].name : "—";
  const latest = [...entries].sort((a, b) => b.date.localeCompare(a.date))[0];
  $("#latestStat").textContent = latest ? moods[latest.mood].name : "—";
  renderHistory();
}

function renderHistory() {
  const list = $("#historyList");
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  if (!sorted.length) {
    list.innerHTML = `<p class="history-empty">還沒有紀錄，今天就種下第一朵花吧！</p>`;
    return;
  }
  list.innerHTML = sorted.slice(0, 8).map((entry) => {
    const mood = moods[entry.mood];
    return `<div class="history-item">
      <button class="history-main" data-history-date="${entry.date}" type="button">
        <span class="history-icon" style="--mood:${mood.color}">${mood.plant}</span>
        <span><strong>${mood.name}</strong><small>${dateFormatter.format(parseDate(entry.date))}</small></span>
        <span class="history-note">${escapeHtml(entry.note || "今天只留下了心情。")}</span>
      </button>
      <button class="delete-entry" data-delete-date="${entry.date}" type="button" aria-label="刪除 ${entry.date} 的紀錄">×</button>
    </div>`;
  }).join("");
}

function getPeriodDates() {
  const today = new Date();
  if (calendarView === "week") {
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() + calendarOffset * 7);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }
  const month = new Date(today.getFullYear(), today.getMonth() + calendarOffset, 1);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(firstDay);
  start.setDate(1 - firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

function renderCalendar() {
  const dates = getPeriodDates();
  const current = dates[Math.floor(dates.length / 2)];
  $("#calendarTitle").textContent = calendarView === "week"
    ? `${dates[0].getMonth() + 1}月 ${dates[0].getDate()}日 — ${dates[6].getMonth() + 1}月 ${dates[6].getDate()}日`
    : monthFormatter.format(current);
  const entryMap = Object.fromEntries(entries.map((entry) => [entry.date, entry]));
  const activeMonth = current.getMonth();
  $("#calendarGrid").innerHTML = dates.map((date) => {
    const dateKey = localDate(date);
    const entry = entryMap[dateKey];
    const mood = entry ? moods[entry.mood] : null;
    const classes = ["calendar-day"];
    if (date.getMonth() !== activeMonth && calendarView === "month") classes.push("other-month");
    if (dateKey === localDate()) classes.push("today");
    if (entry) classes.push("has-entry");
    return `<button class="${classes.join(" ")}" style="${mood ? `--mood:${mood.color}` : ""}" data-date="${dateKey}" type="button">${date.getDate()}${mood ? `<span class="day-icon">${mood.plant}</span>` : ""}</button>`;
  }).join("");
}

function renderLegend() {
  $("#moodLegend").innerHTML = Object.values(moods).map((mood) => `<span class="legend-item"><i class="legend-dot" style="--mood:${mood.color}"></i>${mood.name}</span>`).join("");
}

function showSelectedDay(dateKey) {
  const entry = entries.find((item) => item.date === dateKey);
  const date = parseDate(dateKey);
  $("#selectedDay").innerHTML = entry
    ? `<strong>${dateFormatter.format(date)}・${moods[entry.mood].name}</strong>${entry.note ? `: ${escapeHtml(entry.note)}` : "：今天只留下了心情。"}`
    : "這一天還沒有留下紀錄。";
}

function showPlantDetail(dateKey) {
  const entry = entries.find((item) => item.date === dateKey);
  if (!entry) return;
  const mood = moods[entry.mood];
  $("#plantDetail").innerHTML = `<span class="detail-plant">${mood.plant}</span><span><strong>${dateFormatter.format(parseDate(entry.date))}・${mood.name}</strong><br />${escapeHtml(entry.note || "今天只留下了心情。")}</span>`;
  $("#plantDetail").classList.add("visible");
}

function showMessage(text, isError = false) {
  const message = $("#formMessage");
  message.textContent = text;
  message.className = `form-message${isError ? " error" : ""}`;
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

function initialize() {
  const today = new Date();
  $("#todayLabel").textContent = dateFormatter.format(today);
  $("#formDate").textContent = localDate(today).replaceAll("-", ".");
  const todayEntry = entries.find((entry) => entry.date === localDate());
  if (todayEntry) {
    selectedMood = todayEntry.mood;
    $("#noteInput").value = todayEntry.note || "";
  }
  renderMoodOptions();
  renderGarden();
  renderCalendar();
  renderLegend();
  renderHistory();
  $("#characterCount").textContent = $("#noteInput").value.length;
}

$("#moodOptions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-mood]");
  if (!button) return;
  selectedMood = button.dataset.mood;
  renderMoodOptions();
});

$("#noteInput").addEventListener("input", (event) => {
  $("#characterCount").textContent = event.target.value.length;
});

$("#saveButton").addEventListener("click", () => {
  const message = $("#formMessage");
  if (!selectedMood) {
    showMessage("先選一朵代表今天的心情吧。", true);
    return;
  }
  const date = localDate();
  const entry = { date, mood: selectedMood, note: $("#noteInput").value.trim(), createdAt: new Date().toISOString() };
  const existingIndex = entries.findIndex((item) => item.date === date);
  if (existingIndex >= 0) entries[existingIndex] = entry;
  else entries.push(entry);
  saveEntries();
  renderGarden();
  renderCalendar();
  showMessage(existingIndex >= 0 ? "今天的花朵已更新，謝謝你照顧自己。" : "種下成功！你的花園又多了一點色彩。");
  $("#saveButton").classList.add("saved");
  setTimeout(() => $("#saveButton").classList.remove("saved"), 700);
});

document.querySelectorAll(".calendar-tab").forEach((tab) => tab.addEventListener("click", () => {
  document.querySelector(".calendar-tab.active").classList.remove("active");
  document.querySelector(".calendar-tab.active")?.setAttribute("aria-selected", "false");
  tab.classList.add("active");
  tab.setAttribute("aria-selected", "true");
  calendarView = tab.dataset.view;
  calendarOffset = 0;
  renderCalendar();
}));

$("#previousPeriod").addEventListener("click", () => { calendarOffset -= 1; renderCalendar(); });
$("#nextPeriod").addEventListener("click", () => { calendarOffset += 1; renderCalendar(); });
$("#calendarGrid").addEventListener("click", (event) => {
  const day = event.target.closest("[data-date]");
  if (day) showSelectedDay(day.dataset.date);
});

$("#gardenFilters").addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  gardenFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
  renderGarden();
});

$("#gardenStage").addEventListener("click", (event) => {
  const plant = event.target.closest("[data-date]");
  if (plant) showPlantDetail(plant.dataset.date);
});

$("#historyList").addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-date]");
  if (deleteButton) {
    const date = deleteButton.dataset.deleteDate;
    entries = entries.filter((entry) => entry.date !== date);
    saveEntries();
    renderGarden();
    renderCalendar();
    showMessage("這筆心情已經從花園移除了。");
    return;
  }
  const historyButton = event.target.closest("[data-history-date]");
  if (historyButton) {
    showPlantDetail(historyButton.dataset.historyDate);
    showSelectedDay(historyButton.dataset.historyDate);
  }
});

$("#todayButton").addEventListener("click", () => {
  calendarOffset = 0;
  renderCalendar();
  document.querySelector("#check-in").scrollIntoView({ behavior: "smooth" });
});

$("#clearDataButton").addEventListener("click", () => {
  if (!entries.length || !window.confirm("確定要清除所有心情紀錄嗎？")) return;
  entries = [];
  selectedMood = null;
  $("#noteInput").value = "";
  $("#characterCount").textContent = "0";
  saveEntries();
  renderMoodOptions();
  renderGarden();
  renderCalendar();
  showMessage("花園已整理好，等待你的下一次紀錄。");
});

$("#demoButton").addEventListener("click", () => {
  if (entries.length && !window.confirm("載入示範資料會取代目前的花園，確定要繼續嗎？")) return;
  const today = new Date();
  const sampleNotes = ["完成了一件小事，值得替自己拍拍手。", "午後的風很舒服。", "有點緊張，但我正在慢慢來。", "期待下週的新開始。", "今天想把步調放慢。"];
  entries = sampleNotes.map((note, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (4 - index) * 2);
    return { date: localDate(date), mood: Object.keys(moods)[index], note, createdAt: date.toISOString() };
  });
  saveEntries();
  renderGarden();
  renderCalendar();
  showMessage("示範資料已載入，試著點擊植物或切換日曆看看！");
});

initialize();
