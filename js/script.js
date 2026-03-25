const STORAGE_KEY = "budget_calculator_transactions_v1";
const THEME_KEY = "budget_calculator_theme_v1";

const form = document.getElementById("transactionForm");
const tableBody = document.getElementById("transactionsTableBody");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const balanceEl = document.getElementById("balance");
const savingsRateEl = document.getElementById("savingsRate");
const clearAllBtn = document.getElementById("clearAllBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const filterTypeEl = document.getElementById("filterType");
const filterCategoryEl = document.getElementById("filterCategory");
const themeButtons = document.querySelectorAll(".theme-btn");

let transactions = loadTransactions();

init();

function init() {
  setDefaultDate();
  applySavedTheme();
  renderAll();
  bindEvents();
}

function bindEvents() {
  form.addEventListener("submit", handleFormSubmit);
  clearAllBtn.addEventListener("click", clearAllTransactions);
  exportCsvBtn.addEventListener("click", exportToCsv);
  filterTypeEl.addEventListener("change", renderAll);
  filterCategoryEl.addEventListener("change", renderAll);

  themeButtons.forEach((button) => {
    button.addEventListener("click", () => setTheme(button.dataset.theme));
  });
}

function setDefaultDate() {
  const dateInput = document.getElementById("date");
  if (!dateInput.value) {
    dateInput.value = new Date().toISOString().split("T")[0];
  }
}

function handleFormSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);

  const type = formData.get("type");
  const category = String(formData.get("category")).trim();
  const amount = Number(formData.get("amount"));
  const date = formData.get("date");
  const comment = String(formData.get("comment") || "").trim();

  if (!type || !category || !date || !Number.isFinite(amount) || amount <= 0) {
    alert("Пожалуйста, заполните все обязательные поля корректно.");
    return;
  }

  const transaction = {
    id: crypto.randomUUID(),
    type,
    category,
    amount,
    date,
    comment,
    createdAt: Date.now()
  };

  transactions.unshift(transaction);
  saveTransactions();
  form.reset();
  setDefaultDate();
  renderAll();
}

function clearAllTransactions() {
  if (transactions.length === 0) {
    return;
  }

  const approved = confirm("Удалить все операции без возможности восстановления?");
  if (!approved) {
    return;
  }

  transactions = [];
  saveTransactions();
  renderAll();
}

function deleteTransaction(id) {
  transactions = transactions.filter((item) => item.id !== id);
  saveTransactions();
  renderAll();
}

function renderAll() {
  renderCategoryFilter();
  renderSummary();
  renderTable();
}

function renderSummary() {
  const income = sumByType("income");
  const expense = sumByType("expense");
  const balance = income - expense;
  const savingsRate = income > 0 ? (balance / income) * 100 : 0;

  totalIncomeEl.textContent = formatCurrency(income);
  totalExpenseEl.textContent = formatCurrency(expense);
  balanceEl.textContent = formatCurrency(balance);
  savingsRateEl.textContent = `${Math.max(savingsRate, 0).toFixed(1)}%`;
}

function sumByType(type) {
  return transactions
    .filter((item) => item.type === type)
    .reduce((total, item) => total + item.amount, 0);
}

function renderCategoryFilter() {
  const selected = filterCategoryEl.value || "all";
  const categories = [...new Set(transactions.map((item) => item.category))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );

  filterCategoryEl.innerHTML = `<option value="all">Все категории</option>`;
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    filterCategoryEl.append(option);
  });

  filterCategoryEl.value = categories.includes(selected) ? selected : "all";
}

function getFilteredTransactions() {
  const typeFilter = filterTypeEl.value;
  const categoryFilter = filterCategoryEl.value;

  return transactions.filter((item) => {
    const byType = typeFilter === "all" || item.type === typeFilter;
    const byCategory = categoryFilter === "all" || item.category === categoryFilter;
    return byType && byCategory;
  });
}

function renderTable() {
  const filtered = getFilteredTransactions();
  tableBody.innerHTML = "";

  if (filtered.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty">По выбранным фильтрам нет операций</td></tr>`;
    return;
  }

  filtered.forEach((item) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <span class="type-badge type-badge--${item.type}">
          ${item.type === "income" ? "Доход" : "Расход"}
        </span>
      </td>
      <td>${escapeHtml(item.category)}</td>
      <td>${formatCurrency(item.amount)}</td>
      <td>${formatDate(item.date)}</td>
      <td>${escapeHtml(item.comment || "—")}</td>
      <td><button class="icon-delete" data-id="${item.id}" type="button">Удалить</button></td>
    `;
    tableBody.append(tr);
  });

  tableBody.querySelectorAll(".icon-delete").forEach((button) => {
    button.addEventListener("click", () => deleteTransaction(button.dataset.id));
  });
}

function exportToCsv() {
  if (transactions.length === 0) {
    alert("Нет данных для экспорта.");
    return;
  }

  const rows = [
    ["type", "category", "amount", "date", "comment"],
    ...transactions.map((item) => [
      item.type,
      item.category,
      item.amount.toFixed(2),
      item.date,
      item.comment || ""
    ])
  ];

  const csvContent = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `budget-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
  themeButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.theme === theme);
  });
}

function applySavedTheme() {
  const theme = localStorage.getItem(THEME_KEY) || "light";
  setTheme(theme);
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isValidTransaction).map(normalizeTransaction);
  } catch {
    return [];
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function isValidTransaction(item) {
  return (
    item &&
    typeof item.id === "string" &&
    (item.type === "income" || item.type === "expense") &&
    typeof item.category === "string" &&
    Number.isFinite(Number(item.amount)) &&
    typeof item.date === "string"
  );
}

function normalizeTransaction(item) {
  return {
    id: item.id,
    type: item.type,
    category: item.category.trim(),
    amount: Number(item.amount),
    date: item.date,
    comment: typeof item.comment === "string" ? item.comment : "",
    createdAt: Number(item.createdAt) || Date.now()
  };
}

function formatCurrency(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat("ru-RU").format(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
