(() => {
  "use strict";

  const DATA = window.SCHEDULE_DATA;
  const STORAGE_KEY = "course-pwa-settings-v1";
  const DAY_NAMES = ["星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
  const DAY_SHORT = ["一", "二", "三", "四", "五", "六", "日"];

  const state = {
    settings: loadSettings(),
    selectedWeek: 1,
    selectedDay: 1,
    toastTimer: null
  };

  const elements = {
    semesterLabel: document.getElementById("semesterLabel"),
    weekTitle: document.getElementById("weekTitle"),
    currentWeekChip: document.getElementById("currentWeekChip"),
    dateRange: document.getElementById("dateRange"),
    weekStrip: document.getElementById("weekStrip"),
    dayTitle: document.getElementById("dayTitle"),
    courseCount: document.getElementById("courseCount"),
    courseList: document.getElementById("courseList"),
    weekCourseCount: document.getElementById("weekCourseCount"),
    previousWeek: document.getElementById("previousWeek"),
    nextWeek: document.getElementById("nextWeek"),
    todayButton: document.getElementById("todayButton"),
    settingsButton: document.getElementById("settingsButton"),
    settingsDialog: document.getElementById("settingsDialog"),
    settingsForm: document.getElementById("settingsForm"),
    titleInput: document.getElementById("titleInput"),
    startDateInput: document.getElementById("startDateInput"),
    totalWeeksInput: document.getElementById("totalWeeksInput"),
    resetSettingsButton: document.getElementById("resetSettingsButton"),
    installDialog: document.getElementById("installDialog"),
    installHelpButton: document.getElementById("installHelpButton"),
    installBanner: document.getElementById("installBanner"),
    dismissInstall: document.getElementById("dismissInstall"),
    allWeekButton: document.getElementById("allWeekButton"),
    toast: document.getElementById("toast")
  };

  function defaultSettings() {
    return {
      title: DATA.title,
      startDate: DATA.startDate,
      totalWeeks: DATA.totalWeeks
    };
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && saved.startDate) {
        return {
          title: String(saved.title || DATA.title),
          startDate: String(saved.startDate),
          totalWeeks: Math.min(30, Math.max(1, Number(saved.totalWeeks) || DATA.totalWeeks))
        };
      }
    } catch (error) {
      console.warn(error);
    }
    return defaultSettings();
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.settings));
    } catch (error) {
      showToast("设置保存失败");
    }
  }

  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(NaN);
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function toDateString(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function startOfWeek(date) {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() - ((result.getDay() + 6) % 7));
    return result;
  }

  function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getTermStart() {
    const parsed = parseDate(state.settings.startDate);
    return Number.isNaN(parsed.getTime()) ? startOfWeek(new Date(2026, 8, 7)) : startOfWeek(parsed);
  }

  function getWeekStart(week) {
    return addDays(getTermStart(), (week - 1) * 7);
  }

  function getCurrentWeek() {
    const milliseconds = new Date().setHours(0, 0, 0, 0) - getTermStart().getTime();
    return Math.floor(Math.round(milliseconds / 86400000) / 7) + 1;
  }

  function getTodayDay() {
    return ((new Date().getDay() + 6) % 7) + 1;
  }

  function parseWeekRanges(text) {
    return String(text).split(/[，,、;；]+/).map((token) => {
      const value = token.trim();
      if (!value) return null;
      if (value.includes("-")) {
        const parts = value.split("-").map(Number);
        return [Math.min(parts[0], parts[1]), Math.max(parts[0], parts[1])];
      }
      const week = Number(value);
      return Number.isFinite(week) ? [week, week] : null;
    }).filter(Boolean);
  }

  function matchesWeek(course, week) {
    return parseWeekRanges(course.weeks).some(([start, end]) => week >= start && week <= end);
  }

  function formatWeeks(text) {
    const ranges = parseWeekRanges(text).sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(([start, end]) => {
      const previous = merged[merged.length - 1];
      if (previous && start <= previous[1] + 1) previous[1] = Math.max(previous[1], end);
      else merged.push([start, end]);
    });
    return `第 ${merged.map(([start, end]) => start === end ? start : `${start}-${end}`).join("、")} 周`;
  }

  function getPeriod(groupId) {
    return DATA.periods.find((period) => period.id === groupId) || null;
  }

  function getPeriodIndex(groupId) {
    return DATA.periods.findIndex((period) => period.id === groupId);
  }

  function coursesFor(week, day) {
    return DATA.courses
      .filter((course) => course.day === day && matchesWeek(course, week))
      .sort((a, b) => getPeriodIndex(a.group) - getPeriodIndex(b.group));
  }

  function isLive(course) {
    if (state.selectedWeek !== clamp(getCurrentWeek(), 1, state.settings.totalWeeks)) return false;
    if (course.day !== getTodayDay()) return false;
    const period = getPeriod(course.group);
    if (!period) return false;
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    return minutes >= period.startMinutes && minutes <= period.endMinutes;
  }

  function formatDateRange(week) {
    const start = getWeekStart(week);
    const end = addDays(start, 6);
    return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 - ${end.getMonth() + 1}月${end.getDate()}日`;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderWeekStrip() {
    const fragment = document.createDocumentFragment();
    const weekStart = getWeekStart(state.selectedWeek);
    const currentWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);

    for (let day = 1; day <= 7; day += 1) {
      const date = addDays(weekStart, day - 1);
      const count = coursesFor(state.selectedWeek, day).length;
      const button = makeElement("button", "day-chip");
      button.type = "button";
      if (state.selectedWeek === currentWeek && day === getTodayDay()) button.classList.add("is-today");
      if (state.selectedDay === day) button.classList.add("is-selected");
      button.append(
        makeElement("strong", "", DAY_SHORT[day - 1]),
        makeElement("span", "", `${date.getMonth() + 1}/${date.getDate()}`),
        makeElement("em", "", count ? String(count) : "·")
      );
      button.addEventListener("click", () => {
        state.selectedDay = day;
        render();
      });
      fragment.appendChild(button);
    }
    elements.weekStrip.replaceChildren(fragment);
  }

  function buildCourseCard(course, conflict) {
    const period = getPeriod(course.group);
    const card = makeElement("article", "course-card");
    card.style.setProperty("--accent", course.color);
    if (conflict) card.classList.add("is-conflict");

    const timeRow = makeElement("div", "course-time-row");
    timeRow.appendChild(makeElement("span", "course-time", period ? period.time : course.group));
    if (isLive(course)) timeRow.appendChild(makeElement("span", "live-badge", "正在上课"));
    else if (conflict) timeRow.appendChild(makeElement("span", "conflict-badge", "时间冲突"));

    const title = makeElement("h3", "", course.name);
    const location = makeElement("p", "course-meta");
    location.append(makeElement("strong", "", "地点"), document.createTextNode(course.location || "待定"));
    const teacher = makeElement("p", "course-meta");
    teacher.append(makeElement("strong", "", "教师"), document.createTextNode([course.teacher, course.className].filter(Boolean).join(" · ") || "待定"));
    const weeks = makeElement("p", "week-text", formatWeeks(course.weeks));

    card.append(timeRow, title, location, teacher, weeks);
    return card;
  }

  function renderDay() {
    const date = addDays(getWeekStart(state.selectedWeek), state.selectedDay - 1);
    const courses = coursesFor(state.selectedWeek, state.selectedDay);
    elements.dayTitle.textContent = `${DAY_NAMES[state.selectedDay - 1]} · ${date.getMonth() + 1}月${date.getDate()}日`;
    elements.courseCount.textContent = `${courses.length} 节课`;
    elements.courseList.replaceChildren();

    if (courses.length === 0) {
      const empty = makeElement("div", "empty-state");
      empty.innerHTML = "<div><strong>当天没有课程</strong>可以安排复习或休息</div>";
      elements.courseList.appendChild(empty);
      return;
    }

    const groupCounts = {};
    courses.forEach((course) => {
      const key = `${course.day}-${course.group}`;
      groupCounts[key] = (groupCounts[key] || 0) + 1;
    });

    const fragment = document.createDocumentFragment();
    courses.forEach((course) => {
      fragment.appendChild(buildCourseCard(course, groupCounts[`${course.day}-${course.group}`] > 1));
    });
    elements.courseList.appendChild(fragment);
  }

  function renderHeader() {
    const currentWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);
    elements.semesterLabel.textContent = state.settings.title;
    elements.weekTitle.textContent = `第 ${state.selectedWeek} 周`;
    elements.currentWeekChip.textContent = state.selectedWeek === currentWeek ? "本周" : `当前第 ${currentWeek} 周`;
    elements.dateRange.textContent = formatDateRange(state.selectedWeek);
    elements.weekCourseCount.textContent = `${coursesFor(state.selectedWeek, 1).length + coursesFor(state.selectedWeek, 2).length + coursesFor(state.selectedWeek, 3).length + coursesFor(state.selectedWeek, 4).length + coursesFor(state.selectedWeek, 5).length + coursesFor(state.selectedWeek, 6).length + coursesFor(state.selectedWeek, 7).length} 节`;
  }

  function render() {
    state.selectedWeek = clamp(state.selectedWeek, 1, state.settings.totalWeeks);
    state.selectedDay = clamp(state.selectedDay, 1, 7);
    renderHeader();
    renderWeekStrip();
    renderDay();
  }

  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 2200);
  }

  function openSettings() {
    elements.titleInput.value = state.settings.title;
    elements.startDateInput.value = state.settings.startDate;
    elements.totalWeeksInput.value = String(state.settings.totalWeeks);
    if (!elements.settingsDialog.open) elements.settingsDialog.showModal();
  }

  function saveSettingsFromForm(event) {
    event.preventDefault();
    const start = parseDate(elements.startDateInput.value);
    if (Number.isNaN(start.getTime())) {
      showToast("请选择正确的开始日期");
      return;
    }
    state.settings = {
      title: elements.titleInput.value.trim() || DATA.title,
      startDate: toDateString(startOfWeek(start)),
      totalWeeks: clamp(Number(elements.totalWeeksInput.value) || DATA.totalWeeks, 1, 30)
    };
    state.selectedWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);
    state.selectedDay = getTodayDay();
    saveSettings();
    render();
    elements.settingsDialog.close();
    showToast("设置已保存");
  }

  function resetSettings() {
    state.settings = defaultSettings();
    state.selectedWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);
    state.selectedDay = getTodayDay();
    saveSettings();
    render();
    openSettings();
    showToast("已恢复默认设置");
  }

  function bindEvents() {
    elements.previousWeek.addEventListener("click", () => {
      state.selectedWeek = clamp(state.selectedWeek - 1, 1, state.settings.totalWeeks);
      state.selectedDay = 1;
      render();
    });
    elements.nextWeek.addEventListener("click", () => {
      state.selectedWeek = clamp(state.selectedWeek + 1, 1, state.settings.totalWeeks);
      state.selectedDay = 1;
      render();
    });
    elements.todayButton.addEventListener("click", () => {
      state.selectedWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);
      state.selectedDay = getTodayDay();
      render();
    });
    elements.settingsButton.addEventListener("click", openSettings);
    elements.settingsForm.addEventListener("submit", saveSettingsFromForm);
    elements.resetSettingsButton.addEventListener("click", resetSettings);
    elements.installHelpButton.addEventListener("click", () => {
      if (!elements.installDialog.open) elements.installDialog.showModal();
    });
    elements.allWeekButton.addEventListener("click", () => {
      showToast(`第 ${state.selectedWeek} 周共 ${elements.weekCourseCount.textContent.replace(" 节", "")} 节课`);
    });
    elements.dismissInstall.addEventListener("click", () => {
      localStorage.setItem("course-pwa-install-dismissed", "1");
      elements.installBanner.hidden = true;
    });

    document.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => {
        const dialog = document.getElementById(button.dataset.close);
        if (dialog && dialog.open) dialog.close();
      });
    });

    [elements.settingsDialog, elements.installDialog].forEach((dialog) => {
      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) dialog.close();
      });
    });
  }

  function setupInstallBanner() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("course-pwa-install-dismissed") === "1";
    elements.installBanner.hidden = !isIOS || standalone || dismissed;
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("sw.js").catch((error) => console.warn("Service worker 注册失败", error));
      });
    }
  }

  function init() {
    state.selectedWeek = clamp(getCurrentWeek(), 1, state.settings.totalWeeks);
    state.selectedDay = getTodayDay();
    bindEvents();
    setupInstallBanner();
    registerServiceWorker();
    render();
  }

  init();
})();
