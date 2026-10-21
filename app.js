(() => {
  "use strict";
  const STORAGE_KEY = "yacheyka_station_demo_v1";
  const initialLockers = [
    {id:"A1",size:"S",price:30,position:"A",initiallyOccupied:false},
    {id:"A2",size:"M",price:50,position:"A",initiallyOccupied:false},
    {id:"A3",size:"L",price:80,position:"A",initiallyOccupied:true},
    {id:"A4",size:"S",price:30,position:"A",initiallyOccupied:false},
    {id:"A5",size:"M",price:50,position:"A",initiallyOccupied:false},
    {id:"A6",size:"L",price:80,position:"A",initiallyOccupied:false},
    {id:"B1",size:"M",price:50,position:"B",initiallyOccupied:false},
    {id:"B2",size:"S",price:30,position:"B",initiallyOccupied:false},
    {id:"B3",size:"L",price:100,position:"B",initiallyOccupied:false},
    {id:"B4",size:"M",price:50,position:"B",initiallyOccupied:true},
    {id:"B5",size:"S",price:30,position:"B",initiallyOccupied:false},
    {id:"B6",size:"L",price:80,position:"B",initiallyOccupied:false}
  ];
  const sizeNames = {S:"S · Рюкзак",M:"M · Чемодан",L:"L · Большой багаж"};
  const sizeShort = {S:"S",M:"M",L:"L"};
  const $ = id => document.getElementById(id);
  const state = {selectedId:null,hours:3,filterSize:"all",maxPrice:100,bookings:[],occupiedIds:new Set(),toastTimer:null};

  function loadSaved() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.bookings) || !Array.isArray(parsed.occupiedIds)) throw new Error("bad data");
      state.bookings = parsed.bookings.filter(b => b && typeof b.id === "string" && typeof b.lockerId === "string" && typeof b.name === "string" && Number.isFinite(b.total));
      state.occupiedIds = new Set(parsed.occupiedIds.filter(id => initialLockers.some(l => l.id === id)));
      state.bookings.forEach(b => state.occupiedIds.add(b.lockerId));
    } catch (_) {
      state.bookings = [];
      state.occupiedIds = new Set(initialLockers.filter(l => l.initiallyOccupied).map(l => l.id));
      showToast("Не удалось прочитать сохранённые данные. Начато новое демо.");
    }
    if (state.occupiedIds.size === 0) state.occupiedIds = new Set(initialLockers.filter(l => l.initiallyOccupied).map(l => l.id));
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({bookings:state.bookings,occupiedIds:[...state.occupiedIds]}));
      return true;
    } catch (_) {
      showToast("Браузер не разрешил сохранение. Изменения могут пропасть после обновления.");
      return false;
    }
  }
  function isOccupied(locker) { return state.occupiedIds.has(locker.id); }
  function getLocker(id) { return initialLockers.find(l => l.id === id); }
  function filteredLockers() {
    return initialLockers.filter(l => (state.filterSize === "all" || l.size === state.filterSize) && l.price <= state.maxPrice);
  }
  function formatHours(n) {
    if (n % 10 === 1 && n % 100 !== 11) return `${n} час`;
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return `${n} часа`;
    return `${n} часов`;
  }
  function rub(n) { return `${n.toLocaleString("ru-RU")} ₽`; }
  function createTile(locker) {
    const btn = document.createElement("button");
    const occupied = isOccupied(locker);
    btn.type = "button";
    btn.className = `locker-tile size-${locker.size}${occupied ? " occupied" : ""}${state.selectedId === locker.id ? " selected" : ""}`;
    btn.dataset.id = locker.id;
    btn.disabled = occupied;
    btn.setAttribute("aria-label", `Ячейка ${locker.id}, размер ${locker.size}, ${occupied ? "занята" : "свободна"}, ${locker.price} рублей в час`);
    btn.setAttribute("aria-pressed", state.selectedId === locker.id ? "true" : "false");
    btn.innerHTML = `<span class="tile-id">${locker.id}</span><span class="tile-size">${locker.size}</span><span class="tile-lock" aria-hidden="true">${occupied ? "●" : "⌑"}</span>`;
    btn.addEventListener("click", () => selectLocker(locker.id));
    return btn;
  }
  function renderMap() {
    const visible = new Set(filteredLockers().map(l => l.id));
    for (const position of ["A","B"]) {
      const row = $("mapRow" + position);
      row.replaceChildren();
      initialLockers.filter(l => l.position === position).forEach(locker => {
        const tile = createTile(locker);
        if (!visible.has(locker.id)) tile.classList.add("filtered-out");
        row.appendChild(tile);
      });
    }
  }
  function renderList() {
    const list = $("lockerList");
    list.replaceChildren();
    const visible = filteredLockers();
    $("listResultText").textContent = `${visible.length} ${visible.length === 1 ? "ячейка" : "ячеек"}`;
    $("noResults").hidden = visible.length !== 0;
    visible.forEach(locker => {
      const occupied = isOccupied(locker);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `locker-card${state.selectedId === locker.id ? " active" : ""}`;
      btn.disabled = occupied;
      btn.setAttribute("aria-label", `Ячейка ${locker.id}, ${sizeNames[locker.size]}, ${occupied ? "занята" : "свободна"}`);
      btn.setAttribute("aria-pressed", state.selectedId === locker.id ? "true" : "false");
      btn.innerHTML = `<span class="card-top"><span class="card-size">${locker.size} · ${locker.size === "S" ? "МИНИ" : locker.size === "M" ? "СРЕДНЯЯ" : "МАКСИ"}</span><i class="card-status"></i></span><strong>Ячейка ${locker.id}</strong><p>${occupied ? "Сейчас занята" : sizeNames[locker.size]}</p><span class="card-price">${rub(locker.price)} <small>/ час</small></span>`;
      btn.addEventListener("click", () => selectLocker(locker.id));
      list.appendChild(btn);
    });
  }
  function renderAvailability() {
    const available = initialLockers.filter(l => !isOccupied(l)).length;
    $("availableCount").textContent = available;
    $("bookingCount").textContent = state.bookings.length;
    $("modalCount").textContent = state.bookings.length;
  }
  function renderDetails() {
    const locker = getLocker(state.selectedId);
    const form = $("bookingForm"), empty = $("emptyState"), occupied = $("occupiedState");
    if (!locker) {
      $("detailTitle").textContent = "Выбери шкафчик";
      form.hidden = true; occupied.hidden = true; empty.hidden = false;
      return;
    }
    $("detailTitle").textContent = isOccupied(locker) ? "Ячейка занята" : "Отличный выбор!";
    empty.hidden = true;
    if (isOccupied(locker)) { form.hidden = true; occupied.hidden = false; return; }
    occupied.hidden = true; form.hidden = false;
    $("detailLockerIcon").textContent = sizeShort[locker.size];
    $("detailName").textContent = `Ячейка ${locker.id}`;
    $("detailSize").textContent = sizeNames[locker.size];
    $("detailPrice").textContent = rub(locker.price);
    $("hoursInput").value = state.hours;
    $("hoursDisplay").textContent = formatHours(state.hours);
    $("priceMath").textContent = `${rub(locker.price)} × ${state.hours} ч`;
    $("totalPrice").textContent = rub(locker.price * state.hours);
    $("formError").textContent = "";
  }
  function render() {
    renderMap(); renderList(); renderAvailability(); renderDetails();
  }
  function selectLocker(id) {
    const locker = getLocker(id);
    if (!locker || isOccupied(locker)) return;
    state.selectedId = id;
    render();
    if (window.matchMedia("(max-width: 650px)").matches) {
      $("details-panel")?.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
  }
  function showToast(message) {
    const toast = $("toast");
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }
  function renderBookings() {
    const list = $("myBookingsList");
    list.replaceChildren();
    $("noBookings").hidden = state.bookings.length > 0;
    state.bookings.forEach(booking => {
      const item = document.createElement("article");
      item.className = "booking-item";
      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `Ячейка ${booking.lockerId} · ${booking.name}`;
      const desc = document.createElement("p");
      desc.textContent = `${sizeNames[booking.size]} · ${formatHours(booking.hours)} · № ${booking.id}`;
      info.append(title, desc);
      const total = document.createElement("div");
      total.className = "booking-total";
      total.textContent = rub(booking.total);
      const sub = document.createElement("small"); sub.textContent = "итого"; total.appendChild(sub);
      const cancel = document.createElement("button");
      cancel.type = "button"; cancel.className = "cancel-button"; cancel.textContent = "Отменить бронь и освободить ячейку";
      cancel.addEventListener("click", () => cancelBooking(booking.id));
      item.append(info,total,cancel); list.appendChild(item);
    });
    $("bookingCount").textContent = state.bookings.length;
    $("modalCount").textContent = state.bookings.length;
  }
  function cancelBooking(id) {
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return;
    state.bookings = state.bookings.filter(b => b.id !== id);
    state.occupiedIds.delete(booking.lockerId);
    save();
    if (state.selectedId === booking.lockerId) state.selectedId = null;
    render(); renderBookings();
    showToast(`Ячейка ${booking.lockerId} снова свободна`);
  }
  function setHours(n) {
    state.hours = Math.max(1, Math.min(24, n));
    renderDetails();
  }
  $("sizeFilter").addEventListener("change", e => {
    state.filterSize = e.target.value;
    if (state.selectedId && !filteredLockers().some(l => l.id === state.selectedId)) {
      state.selectedId = null;
      showToast("Выбранная ячейка скрыта фильтром — выбор сброшен.");
    }
    render();
  });
  $("priceFilter").addEventListener("input", e => {
    state.maxPrice = Number(e.target.value);
    $("priceValue").textContent = `${state.maxPrice} ₽`;
    if (state.selectedId && !filteredLockers().some(l => l.id === state.selectedId)) {
      state.selectedId = null;
      showToast("Выбранная ячейка скрыта фильтром — выбор сброшен.");
    }
    render();
  });
  $("resetFilters").addEventListener("click", () => {
    state.filterSize = "all"; state.maxPrice = 100;
    $("sizeFilter").value = "all"; $("priceFilter").value = "100"; $("priceValue").textContent = "100 ₽";
    render(); showToast("Фильтры сброшены");
  });
  $("minusHours").addEventListener("click", () => setHours(state.hours - 1));
  $("plusHours").addEventListener("click", () => setHours(state.hours + 1));
  $("bookingForm").addEventListener("submit", e => {
    e.preventDefault();
    const locker = getLocker(state.selectedId);
    const name = $("guestName").value.trim();
    if (!locker || isOccupied(locker)) { $("formError").textContent = "Сначала выбери свободную ячейку."; return; }
    if (!name) { $("formError").textContent = "Напиши, как к тебе обращаться."; $("guestName").focus(); return; }
    if (!Number.isInteger(state.hours) || state.hours < 1 || state.hours > 24) { $("formError").textContent = "Время должно быть от 1 до 24 часов."; return; }
    if (state.bookings.some(b => b.lockerId === locker.id)) { $("formError").textContent = "Эта ячейка уже забронирована."; return; }
    const booking = {id:"YC-" + Math.random().toString(36).slice(2,8).toUpperCase(),lockerId:locker.id,size:locker.size,name,hours:state.hours,total:locker.price*state.hours,createdAt:new Date().toISOString()};
    state.bookings.push(booking); state.occupiedIds.add(locker.id);
    save(); state.selectedId = null; $("guestName").value = "";
    render(); renderBookings();
    showToast(`✓ Готово! Ячейка ${locker.id} забронирована · ${rub(booking.total)}`);
  });
  $("chooseAnother").addEventListener("click", () => { state.selectedId = null; render(); $("lockerMap").scrollIntoView({behavior:"smooth",block:"center"}); });
  const modal = $("bookingsModal");
  function openModal() { renderBookings(); modal.hidden = false; $("closeBookings").focus(); document.body.style.overflow = "hidden"; }
  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; $("openBookings").focus(); }
  $("openBookings").addEventListener("click", openModal);
  $("closeBookings").addEventListener("click", closeModal);
  $("closeBookingsBottom").addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !modal.hidden) closeModal(); });
  $("resetDemo").addEventListener("click", () => {
    if (!window.confirm("Сбросить учебное демо? Все твои брони будут удалены, исходные занятые ячейки восстановятся.")) return;
    state.bookings = [];
    state.occupiedIds = new Set(initialLockers.filter(l => l.initiallyOccupied).map(l => l.id));
    state.selectedId = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    save(); render(); renderBookings(); closeModal(); showToast("Демо сброшено. Можно начать заново!");
  });
  loadSaved();
  render();
  renderBookings();
})();