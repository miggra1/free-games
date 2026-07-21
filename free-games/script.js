const searchInput = document.querySelector("#gameSearch");
const filterButtons = document.querySelectorAll("[data-filter]");
const cards = Array.from(document.querySelectorAll("[data-game-card]"));
const gridCards = Array.from(document.querySelectorAll(".game-grid [data-game-card]"));
const resultCount = document.querySelector("#resultCount");

let activeFilter = "all";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function updateCards() {
  const query = normalize(searchInput && searchInput.value);
  let visible = 0;

  for (const card of cards) {
    const tags = normalize(card.dataset.tags);
    const title = normalize(card.dataset.title);
    const matchesFilter = activeFilter === "all" || tags.includes(activeFilter);
    const matchesSearch = !query || title.includes(query) || tags.includes(query);
    const show = matchesFilter && matchesSearch;
    card.classList.toggle("hidden", !show);
    if (show && gridCards.includes(card)) visible += 1;
  }

  if (resultCount) resultCount.textContent = visible + " games";
}

for (const button of filterButtons) {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    updateCards();
  });
}

if (searchInput) searchInput.addEventListener("input", updateCards);
updateCards();
