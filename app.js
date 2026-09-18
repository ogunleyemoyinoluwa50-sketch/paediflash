// PaediFlash - Client-side Application Logic

let allCards = [];
let filteredCards = [];
let currentCardIndex = 0;
let userChoices = {}; // { statementId: true/false }
let isRevealed = false;
let categories = [];
let decks = [];

// LocalStorage Persistence for Spaced Repetition & Bookmarks
const STORAGE_KEY = "paediflash_user_data_v1";
let userData = {
  cardStatus: {}, // { card_id: { status: 'unstudied'|'learning'|'mastered', attempts: 0, correct: 0, lastReviewed: null } }
  bookmarks: {}, // { card_id: true }
  history: []
};

// Quiz Session State
let quizSession = {
  active: false,
  questions: [],
  currentIndex: 0,
  userAnswers: [], // [{ cardId, choices: {}, score: 0, maxScore: 5 }]
  timerInterval: null,
  secondsElapsed: 0
};

// PDF Navigator State
let currentPdfPage = 1;
let pdfDpi = 150;

// Initialize App
document.addEventListener("DOMContentLoaded", () => {
  loadUserData();
  fetchInitialData();
  setupKeyboardShortcuts();
});

function loadUserData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      userData = JSON.parse(saved);
    } catch (e) {
      console.error("Could not parse saved user data", e);
    }
  }
}

function saveUserData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  updateStatsView();
}

async function fetchInitialData() {
  try {
    const [cardsRes, catsRes, decksRes] = await Promise.all([
      fetch("/api/cards"),
      fetch("/api/categories"),
      fetch("/api/decks")
    ]);

    allCards = await cardsRes.json();
    categories = await catsRes.json();
    decks = await decksRes.json();

    populateFilterDropdowns();
    filteredCards = [...allCards];
    currentCardIndex = 0;
    renderCurrentCard();
    renderLibrary();
    updateStatsView();
  } catch (err) {
    console.error("Error fetching data:", err);
    showToast("Error loading cards from server");
  }
}

function populateFilterDropdowns() {
  const catSelect = document.getElementById("study-category-select");
  const libCatSelect = document.getElementById("library-category-select");
  const quizCatSelect = document.getElementById("quiz-category-select");

  categories.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = `${c.name} (${c.count})`;
    catSelect.appendChild(opt);

    const opt2 = document.createElement("option");
    opt2.value = c.name;
    opt2.textContent = `${c.name} (${c.count})`;
    libCatSelect.appendChild(opt2);

    const opt3 = document.createElement("option");
    opt3.value = c.name;
    opt3.textContent = `${c.name} (${c.count})`;
    quizCatSelect.appendChild(opt3);
  });

  const deckSelect = document.getElementById("study-deck-select");
  decks.forEach(d => {
    const opt = document.createElement("option");
    opt.value = d.name;
    opt.textContent = `${d.name} (${d.count})`;
    deckSelect.appendChild(opt);
  });
}

// ----------------------------------------------------
// FLASHCARD STUDY VIEW
// ----------------------------------------------------

function renderCurrentCard() {
  if (filteredCards.length === 0) {
    document.getElementById("card-title").textContent = "No cards found";
    document.getElementById("card-vignette").textContent = "Try adjusting your search or specialty filters.";
    document.getElementById("statements-list").innerHTML = "";
    document.getElementById("card-clinical-img").src = "";
    document.getElementById("card-counter").textContent = "0 of 0";
    return;
  }

  const card = filteredCards[currentCardIndex];
  userChoices = {};
  isRevealed = false;

  // Header & Counters
  document.getElementById("card-counter").textContent = `Card ${currentCardIndex + 1} of ${filteredCards.length}`;
  const pct = ((currentCardIndex + 1) / filteredCards.length) * 100;
  document.getElementById("card-progress-bar").style.width = `${pct}%`;

  document.getElementById("card-category-badge").textContent = card.category;
  document.getElementById("card-deck-badge").textContent = card.deck;
  document.getElementById("card-page-label").textContent = card.page;
  document.getElementById("current-slide-page-num").textContent = `#${card.page}`;

  // Mastery Badge
  const statusInfo = userData.cardStatus[card.id] || { status: 'unstudied' };
  const masteryBadge = document.getElementById("card-mastery-badge");
  if (statusInfo.status === 'mastered') {
    masteryBadge.textContent = "Mastered ⭐";
    masteryBadge.style.background = "#dcfce7";
    masteryBadge.style.color = "#166534";
  } else if (statusInfo.status === 'learning') {
    masteryBadge.textContent = "Learning ⏳";
    masteryBadge.style.background = "#fef3c7";
    masteryBadge.style.color = "#92400e";
  } else {
    masteryBadge.textContent = "Unstudied";
    masteryBadge.style.background = "#e2e8f0";
    masteryBadge.style.color = "#475569";
  }

  // Bookmark Button State
  const bmBtn = document.getElementById("bookmark-btn");
  if (userData.bookmarks[card.id]) {
    bmBtn.innerHTML = "★ Bookmarked";
    bmBtn.style.color = "#f59e0b";
  } else {
    bmBtn.innerHTML = "☆ Bookmark";
    bmBtn.style.color = "var(--text-primary)";
  }

  // Title & Vignette
  document.getElementById("card-title").textContent = card.title;
  document.getElementById("card-vignette").textContent = card.vignette;

  // Clinical Image
  const imgEl = document.getElementById("card-clinical-img");
  imgEl.src = `/api/page/${card.page}?dpi=130`;
  imgEl.alt = `${card.title} - Page ${card.page}`;

  // Render Statements
  const stList = document.getElementById("statements-list");
  stList.innerHTML = "";

  card.statements.forEach((st, idx) => {
    const item = document.createElement("div");
    item.className = "statement-item";
    item.id = `st-item-${st.id}`;

    item.innerHTML = `
      <div class="statement-header">
        <div class="statement-text">
          <span class="statement-num">${st.id}.</span> ${st.text}
        </div>
        <div class="statement-buttons">
          <button class="tf-btn" id="btn-t-${st.id}" onclick="selectChoice('${st.id}', true)">T</button>
          <button class="tf-btn" id="btn-f-${st.id}" onclick="selectChoice('${st.id}', false)">F</button>
        </div>
      </div>
      <div class="explanation-container" id="exp-${st.id}" style="display: none;"></div>
    `;
    stList.appendChild(item);
  });

  // Reset Revealed Section
  document.getElementById("revealed-section").style.display = "none";
  document.getElementById("clinical-summary-text").textContent = card.clinical_summary || "";
  document.getElementById("original-notes-text").textContent = card.original_notes || "None on slide.";

  // Controls
  document.getElementById("reveal-btn-container").style.display = "block";
  document.getElementById("srs-controls").style.display = "none";
  document.getElementById("reveal-card-btn").innerHTML = `<span>👁️</span> Check Answers & Explain All`;
}

function selectChoice(stmtId, isTrue) {
  if (isRevealed) return; // Prevent changing after revealing
  userChoices[stmtId] = isTrue;

  const btnT = document.getElementById(`btn-t-${stmtId}`);
  const btnF = document.getElementById(`btn-f-${stmtId}`);

  if (isTrue) {
    btnT.className = "tf-btn selected-t";
    btnF.className = "tf-btn";
  } else {
    btnT.className = "tf-btn";
    btnF.className = "tf-btn selected-f";
  }
}

function resetCardChoices() {
  if (isRevealed) return;
  userChoices = {};
  const card = filteredCards[currentCardIndex];
  card.statements.forEach(st => {
    document.getElementById(`btn-t-${st.id}`).className = "tf-btn";
    document.getElementById(`btn-f-${st.id}`).className = "tf-btn";
  });
}

function toggleRevealAnswers() {
  if (isRevealed) return;
  isRevealed = true;

  const card = filteredCards[currentCardIndex];
  let correctCount = 0;

  card.statements.forEach(st => {
    const userAns = userChoices[st.id];
    const correctAns = st.answer;
    const hasAnswered = userAns !== undefined;
    const isCorrect = userAns === correctAns;

    if (isCorrect) correctCount++;

    const expDiv = document.getElementById(`exp-${st.id}`);
    expDiv.style.display = "block";

    let badgeHtml = "";
    if (hasAnswered) {
      if (isCorrect) {
        badgeHtml = `<span class="result-badge correct">✓ Correct (${userAns ? 'True' : 'False'})</span>`;
      } else {
        badgeHtml = `<span class="result-badge incorrect">✗ Your choice: ${userAns ? 'True' : 'False'} (Incorrect)</span>`;
      }
    } else {
      badgeHtml = `<span class="result-badge" style="background: #f1f5f9; color: #475569;">Not answered</span>`;
    }

    const verdictHtml = correctAns 
      ? `<span class="verdict-tag true">TRUE:</span>` 
      : `<span class="verdict-tag false">FALSE:</span>`;

    expDiv.innerHTML = `
      <div style="margin-bottom: 0.35rem;">${badgeHtml}</div>
      <div class="explanation-text">
        ${verdictHtml} ${st.explanation}
      </div>
    `;

    // Highlight the correct button with green/red
    const btnT = document.getElementById(`btn-t-${st.id}`);
    const btnF = document.getElementById(`btn-f-${st.id}`);
    if (correctAns === true) {
      btnT.style.borderColor = "#10b981";
      btnT.style.fontWeight = "900";
    } else {
      btnF.style.borderColor = "#ef4444";
      btnF.style.fontWeight = "900";
    }
  });

  // Reveal summary & SRS buttons
  document.getElementById("revealed-section").style.display = "block";
  document.getElementById("reveal-btn-container").style.display = "none";
  document.getElementById("srs-controls").style.display = "flex";

  // Record stats
  if (!userData.cardStatus[card.id]) {
    userData.cardStatus[card.id] = { status: 'learning', attempts: 0, correct: 0, lastReviewed: null };
  }
  userData.cardStatus[card.id].attempts += 1;
  userData.cardStatus[card.id].correct += correctCount;
  userData.cardStatus[card.id].lastReviewed = new Date().toISOString();
  saveUserData();
}

function rateCard(rating) {
  const card = filteredCards[currentCardIndex];
  if (!userData.cardStatus[card.id]) {
    userData.cardStatus[card.id] = { status: 'learning', attempts: 1, correct: 0, lastReviewed: new Date().toISOString() };
  }

  if (rating === 'easy') {
    userData.cardStatus[card.id].status = 'mastered';
    showToast("Marked as Mastered ⭐");
  } else if (rating === 'good') {
    userData.cardStatus[card.id].status = 'mastered';
    showToast("Saved to review in 4 days 👍");
  } else if (rating === 'hard') {
    userData.cardStatus[card.id].status = 'learning';
    showToast("Scheduled for review in 2 days ⏳");
  } else {
    userData.cardStatus[card.id].status = 'learning';
    showToast("Added to today's repeat queue 🔄");
  }

  saveUserData();
  nextCard();
}

function nextCard() {
  if (filteredCards.length === 0) return;
  if (currentCardIndex < filteredCards.length - 1) {
    currentCardIndex++;
  } else {
    currentCardIndex = 0; // wrap around
  }
  renderCurrentCard();
}

function prevCard() {
  if (filteredCards.length === 0) return;
  if (currentCardIndex > 0) {
    currentCardIndex--;
  } else {
    currentCardIndex = filteredCards.length - 1;
  }
  renderCurrentCard();
}

function randomCard() {
  if (filteredCards.length <= 1) return;
  let nextIdx = currentCardIndex;
  while (nextIdx === currentCardIndex) {
    nextIdx = Math.floor(Math.random() * filteredCards.length);
  }
  currentCardIndex = nextIdx;
  renderCurrentCard();
}

function toggleBookmarkCurrentCard() {
  const card = filteredCards[currentCardIndex];
  if (!card) return;
  if (userData.bookmarks[card.id]) {
    delete userData.bookmarks[card.id];
    showToast("Removed bookmark");
  } else {
    userData.bookmarks[card.id] = true;
    showToast("Card bookmarked ⭐");
  }
  saveUserData();
  renderCurrentCard();
}

function viewOriginalSlideForCurrentCard() {
  const card = filteredCards[currentCardIndex];
  if (!card) return;
  switchTab('pdf');
  jumpPdfPage(card.page);
}

// ----------------------------------------------------
// SEARCH & FILTERING
// ----------------------------------------------------

function handleSearch(val) {
  applyFilters();
}

function filterByCategory(val) {
  applyFilters();
}

function filterByDeck(val) {
  applyFilters();
}

function applyFilters() {
  const searchVal = document.getElementById("study-search-input").value.toLowerCase().trim();
  const catVal = document.getElementById("study-category-select").value;
  const deckVal = document.getElementById("study-deck-select").value;

  filteredCards = allCards.filter(c => {
    const matchesCat = (catVal === "All" || c.category === catVal);
    const matchesDeck = (deckVal === "All" || c.deck === deckVal);
    const matchesSearch = !searchVal || (
      c.title.toLowerCase().includes(searchVal) ||
      c.vignette.toLowerCase().includes(searchVal) ||
      (c.clinical_summary && c.clinical_summary.toLowerCase().includes(searchVal)) ||
      c.statements.some(s => s.text.toLowerCase().includes(searchVal) || s.explanation.toLowerCase().includes(searchVal))
    );
    return matchesCat && matchesDeck && matchesSearch;
  });

  currentCardIndex = 0;
  renderCurrentCard();
}

// ----------------------------------------------------
// CARD LIBRARY / BROWSE MODE
// ----------------------------------------------------

function renderLibrary() {
  const grid = document.getElementById("library-grid");
  const searchVal = (document.getElementById("library-search-input")?.value || "").toLowerCase().trim();
  const catVal = document.getElementById("library-category-select")?.value || "All";
  const statusVal = document.getElementById("library-status-select")?.value || "All";

  const cardsToRender = allCards.filter(c => {
    const matchesCat = (catVal === "All" || c.category === catVal);
    const matchesSearch = !searchVal || (
      c.title.toLowerCase().includes(searchVal) ||
      c.vignette.toLowerCase().includes(searchVal) ||
      (c.clinical_summary && c.clinical_summary.toLowerCase().includes(searchVal))
    );
    
    const cardStatus = userData.cardStatus[c.id]?.status || 'unstudied';
    const isBookmarked = !!userData.bookmarks[c.id];
    let matchesStatus = true;
    if (statusVal === 'unstudied') matchesStatus = (cardStatus === 'unstudied');
    else if (statusVal === 'learning') matchesStatus = (cardStatus === 'learning');
    else if (statusVal === 'mastered') matchesStatus = (cardStatus === 'mastered');
    else if (statusVal === 'bookmarked') matchesStatus = isBookmarked;

    return matchesCat && matchesSearch && matchesStatus;
  });

  document.getElementById("library-count").textContent = cardsToRender.length;
  grid.innerHTML = "";

  if (cardsToRender.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: var(--text-muted);">No flashcards match the selected filters.</div>`;
    return;
  }

  cardsToRender.forEach(c => {
    const item = document.createElement("div");
    item.className = "library-card";
    item.onclick = () => {
      // Find index in filtered or all cards
      const idx = allCards.findIndex(x => x.id === c.id);
      if (idx !== -1) {
        filteredCards = [...allCards];
        currentCardIndex = idx;
        switchTab('study');
        renderCurrentCard();
      }
    };

    const isBookmarked = userData.bookmarks[c.id] ? "★" : "";
    const cardStatus = userData.cardStatus[c.id]?.status || 'unstudied';

    item.innerHTML = `
      <div class="library-card-img-wrap">
        <img class="library-card-img" src="/api/page/${c.page}?dpi=72" alt="${c.title}" loading="lazy">
      </div>
      <div class="library-card-content">
        <div class="library-card-category">${c.category}</div>
        <div class="library-card-title">${c.title} ${isBookmarked ? '<span style="color:#f59e0b;">★</span>' : ''}</div>
        <div class="library-card-vignette">${c.vignette}</div>
        <div class="library-card-footer">
          <span>Page ${c.page} • 5 Items</span>
          <span class="badge" style="font-size:0.7rem; ${cardStatus === 'mastered' ? 'background:#dcfce7;color:#166534;' : cardStatus === 'learning' ? 'background:#fef3c7;color:#92400e;' : 'background:#e2e8f0;color:#475569;'}">${cardStatus}</span>
        </div>
      </div>
    `;
    grid.appendChild(item);
  });
}

function handleLibrarySearch(val) {
  renderLibrary();
}

function filterLibraryCategory(val) {
  renderLibrary();
}

function filterLibraryStatus(val) {
  renderLibrary();
}

// ----------------------------------------------------
// PRACTICE / QUIZ MODE
// ----------------------------------------------------

function startQuizSession() {
  const lengthVal = document.getElementById("quiz-length-select").value;
  const catVal = document.getElementById("quiz-category-select").value;

  let pool = allCards;
  if (catVal !== "All") {
    pool = pool.filter(c => c.category === catVal);
  }

  if (pool.length === 0) {
    alert("No questions found for this specialty!");
    return;
  }

  // Shuffle questions
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  const numQuestions = lengthVal === "all" ? shuffled.length : Math.min(parseInt(lengthVal), shuffled.length);

  quizSession = {
    active: true,
    questions: shuffled.slice(0, numQuestions),
    currentIndex: 0,
    userAnswers: [],
    secondsElapsed: 0,
    timerInterval: null
  };

  // Switch UI to Active Quiz
  document.getElementById("quiz-setup-container").style.display = "none";
  document.getElementById("quiz-results-container").style.display = "none";
  document.getElementById("quiz-active-container").style.display = "block";

  // Start Timer
  quizSession.timerInterval = setInterval(() => {
    quizSession.secondsElapsed++;
    const mins = String(Math.floor(quizSession.secondsElapsed / 60)).padStart(2, '0');
    const secs = String(quizSession.secondsElapsed % 60).padStart(2, '0');
    document.getElementById("quiz-timer").textContent = `${mins}:${secs}`;
  }, 1000);

  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizSession.questions[quizSession.currentIndex];
  document.getElementById("quiz-question-counter").textContent = `Question ${quizSession.currentIndex + 1} of ${quizSession.questions.length}`;

  const container = document.getElementById("quiz-card-placeholder");
  container.innerHTML = `
    <div class="flashcard">
      <div class="card-topbar">
        <div class="card-badges">
          <span class="badge badge-primary">${q.category}</span>
          <span class="badge badge-deck">${q.deck}</span>
        </div>
        <div style="font-size:0.85rem; color:var(--text-muted); font-weight:600;">Slide #${q.page}</div>
      </div>
      <div class="card-title-section">
        <h2>${q.title}</h2>
        <div class="card-vignette">${q.vignette}</div>
      </div>
      <div class="card-body-grid">
        <div class="clinical-image-col">
          <div class="image-container" onclick="openModalWithSrc('/api/page/${q.page}?dpi=200')">
            <img class="clinical-img" src="/api/page/${q.page}?dpi=130" alt="${q.title}">
            <button class="image-overlay-btn" type="button"><span>🔍</span> Click to Expand</button>
          </div>
        </div>
        <div class="statements-col">
          <div style="font-size:0.85rem; font-weight:700; color:var(--text-muted); margin-bottom:0.5rem; text-transform:uppercase;">
            Mark True (T) or False (F):
          </div>
          <div class="statements-list" id="quiz-stmts-list"></div>
        </div>
      </div>
    </div>
  `;

  const stList = document.getElementById("quiz-stmts-list");
  q.statements.forEach(st => {
    const item = document.createElement("div");
    item.className = "statement-item";
    item.innerHTML = `
      <div class="statement-header">
        <div class="statement-text">
          <span class="statement-num">${st.id}.</span> ${st.text}
        </div>
        <div class="statement-buttons">
          <button class="tf-btn" id="quiz-t-${st.id}" onclick="selectQuizChoice('${st.id}', true)">T</button>
          <button class="tf-btn" id="quiz-f-${st.id}" onclick="selectQuizChoice('${st.id}', false)">F</button>
        </div>
      </div>
    `;
    stList.appendChild(item);
  });

  // Current temporary choices
  quizSession.currentChoices = {};
}

function selectQuizChoice(stmtId, val) {
  quizSession.currentChoices[stmtId] = val;
  const btnT = document.getElementById(`quiz-t-${stmtId}`);
  const btnF = document.getElementById(`quiz-f-${stmtId}`);
  if (val) {
    btnT.className = "tf-btn selected-t";
    btnF.className = "tf-btn";
  } else {
    btnT.className = "tf-btn";
    btnF.className = "tf-btn selected-f";
  }
}

function submitCurrentQuizQuestion() {
  const q = quizSession.questions[quizSession.currentIndex];
  let correctCount = 0;
  const totalStatements = q.statements.length;

  q.statements.forEach(st => {
    if (quizSession.currentChoices[st.id] === st.answer) {
      correctCount++;
    }
  });

  quizSession.userAnswers.push({
    cardId: q.id,
    title: q.title,
    category: q.category,
    choices: { ...quizSession.currentChoices },
    score: correctCount,
    maxScore: totalStatements
  });

  if (quizSession.currentIndex < quizSession.questions.length - 1) {
    quizSession.currentIndex++;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
}

function endQuizSessionEarly() {
  if (confirm("Are you sure you want to exit the exam early?")) {
    clearInterval(quizSession.timerInterval);
    document.getElementById("quiz-active-container").style.display = "none";
    document.getElementById("quiz-setup-container").style.display = "block";
  }
}

function finishQuiz() {
  clearInterval(quizSession.timerInterval);
  document.getElementById("quiz-active-container").style.display = "none";
  document.getElementById("quiz-results-container").style.display = "block";

  const totalPossible = quizSession.userAnswers.reduce((sum, a) => sum + a.maxScore, 0);
  const totalEarned = quizSession.userAnswers.reduce((sum, a) => sum + a.score, 0);
  const percentage = Math.round((totalEarned / totalPossible) * 100);

  document.getElementById("quiz-score-percentage").textContent = `${percentage}%`;
  document.getElementById("quiz-score-fraction").textContent = `${totalEarned} / ${totalPossible} statements correct`;

  // Specialty Breakdown
  const catStats = {};
  quizSession.userAnswers.forEach(a => {
    if (!catStats[a.category]) catStats[a.category] = { correct: 0, total: 0 };
    catStats[a.category].correct += a.score;
    catStats[a.category].total += a.maxScore;
  });

  const bDiv = document.getElementById("quiz-specialty-breakdown");
  bDiv.innerHTML = `<h3 style="font-size:1rem; margin-bottom:0.75rem;">Specialty Breakdown:</h3>`;
  for (const [cat, data] of Object.entries(catStats)) {
    const cPct = Math.round((data.correct / data.total) * 100);
    bDiv.innerHTML += `
      <div style="margin-bottom:0.5rem;">
        <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:0.2rem;">
          <span>${cat}</span>
          <span>${cPct}% (${data.correct}/${data.total})</span>
        </div>
        <div class="progress-bar-container" style="width:100%; height:6px;">
          <div class="progress-bar-fill" style="width:${cPct}%; background:${cPct >= 70 ? '#10b981' : cPct >= 50 ? '#f59e0b' : '#ef4444'};"></div>
        </div>
      </div>
    `;
  }
}

function restartQuiz() {
  document.getElementById("quiz-results-container").style.display = "none";
  document.getElementById("quiz-setup-container").style.display = "block";
}

// ----------------------------------------------------
// ORIGINAL PDF SLIDE NAVIGATOR
// ----------------------------------------------------

function jumpPdfPage(pageNum) {
  let p = parseInt(pageNum);
  if (isNaN(p) || p < 1) p = 1;
  if (p > 442) p = 442;
  currentPdfPage = p;
  document.getElementById("pdf-jump-input").value = p;

  const img = document.getElementById("pdf-viewer-img");
  img.src = `/api/page/${p}?dpi=${pdfDpi}`;

  // Check if a card matches this page
  const matchingCard = allCards.find(c => c.page === p);
  const openCardBtn = document.getElementById("open-matching-card-btn");
  if (matchingCard) {
    openCardBtn.style.display = "inline-flex";
    openCardBtn.textContent = `🎴 Study Card: ${matchingCard.title.substring(0, 22)}...`;
  } else {
    openCardBtn.style.display = "none";
  }
}

function navPdfNext() {
  if (currentPdfPage < 442) {
    jumpPdfPage(currentPdfPage + 1);
  }
}

function navPdfPrev() {
  if (currentPdfPage > 1) {
    jumpPdfPage(currentPdfPage - 1);
  }
}

function zoomPdfIn() {
  pdfDpi = Math.min(pdfDpi + 30, 250);
  jumpPdfPage(currentPdfPage);
}

function zoomPdfOut() {
  pdfDpi = Math.max(pdfDpi - 30, 90);
  jumpPdfPage(currentPdfPage);
}

function openMatchingCardFromPdf() {
  const matchingCard = allCards.find(c => c.page === currentPdfPage);
  if (matchingCard) {
    filteredCards = [...allCards];
    currentCardIndex = allCards.findIndex(c => c.id === matchingCard.id);
    switchTab('study');
    renderCurrentCard();
  }
}

// ----------------------------------------------------
// STATS DASHBOARD
// ----------------------------------------------------

function updateStatsView() {
  const totalCards = allCards.length || 65;
  const studiedCount = Object.keys(userData.cardStatus).length;
  const masteredCount = Object.values(userData.cardStatus).filter(s => s.status === 'mastered').length;
  const bookmarkedCount = Object.keys(userData.bookmarks).length;

  let totalAttempts = 0;
  let totalCorrect = 0;
  Object.values(userData.cardStatus).forEach(s => {
    totalAttempts += (s.attempts * 5);
    totalCorrect += (s.correct || 0);
  });

  const accuracyPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const masteryPct = totalCards > 0 ? Math.round((masteredCount / totalCards) * 100) : 0;

  document.getElementById("stat-cards-studied").textContent = `${studiedCount} / ${totalCards}`;
  document.getElementById("stat-mastery-rate").textContent = `${masteryPct}%`;
  document.getElementById("stat-answers-accuracy").textContent = `${accuracyPct}%`;
  document.getElementById("stat-bookmarked-count").textContent = bookmarkedCount;

  // Breakdown by Category
  const barsContainer = document.getElementById("stats-specialty-bars");
  if (!barsContainer) return;
  barsContainer.innerHTML = "";

  categories.forEach(cat => {
    const cardsInCat = allCards.filter(c => c.category === cat.name);
    const catTotal = cardsInCat.length;
    const catMastered = cardsInCat.filter(c => userData.cardStatus[c.id]?.status === 'mastered').length;
    const catStudied = cardsInCat.filter(c => !!userData.cardStatus[c.id]).length;
    const pct = catTotal > 0 ? Math.round((catMastered / catTotal) * 100) : 0;

    const row = document.createElement("div");
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.85rem; font-weight:600; margin-bottom:0.25rem;">
        <span>${cat.name} (${catStudied}/${catTotal} studied)</span>
        <span style="color:var(--primary); font-weight:700;">${pct}% Mastered</span>
      </div>
      <div class="progress-bar-container" style="width:100%; height:8px;">
        <div class="progress-bar-fill" style="width:${pct}%; background:#10b981;"></div>
      </div>
    `;
    barsContainer.appendChild(row);
  });
}

function resetAllStudyProgress() {
  if (confirm("Are you sure you want to reset all your study progress and ratings? This cannot be undone.")) {
    userData = { cardStatus: {}, bookmarks: {}, history: [] };
    saveUserData();
    renderCurrentCard();
    renderLibrary();
    updateStatsView();
    showToast("Study progress has been reset");
  }
}

// ----------------------------------------------------
// UI TABS & MODALS
// ----------------------------------------------------

function switchTab(tabName) {
  ['study', 'library', 'quiz', 'pdf', 'stats'].forEach(t => {
    const el = document.getElementById(`view-${t}`);
    const btn = document.getElementById(`tab-${t}-btn`);
    if (el) el.style.display = (t === tabName) ? "block" : "none";
    if (btn) {
      if (t === tabName) btn.classList.add("active");
      else btn.classList.remove("active");
    }
  });

  if (tabName === 'library') renderLibrary();
  if (tabName === 'stats') updateStatsView();
  if (tabName === 'pdf') jumpPdfPage(currentPdfPage);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("paediflash_theme", next);
}

// Restore saved theme
const savedTheme = localStorage.getItem("paediflash_theme");
if (savedTheme) {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

function openImageModal() {
  const card = filteredCards[currentCardIndex];
  if (!card) return;
  openModalWithSrc(`/api/page/${card.page}?dpi=200`);
}

function openModalWithSrc(src) {
  const modal = document.getElementById("image-modal");
  const modalImg = document.getElementById("modal-img-element");
  modalImg.src = src;
  modal.classList.add("open");
}

function closeImageModal(e) {
  if (!e || e.target.id === "image-modal" || e.target.classList.contains("modal-close-btn")) {
    document.getElementById("image-modal").classList.remove("open");
  }
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

// ----------------------------------------------------
// AUDIO / TEXT-TO-SPEECH (TTS)
// ----------------------------------------------------

function readAloudVignette() {
  if (!('speechSynthesis' in window)) {
    showToast("Text-to-speech is not supported by your browser");
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    showToast("Audio stopped");
    return;
  }

  const card = filteredCards[currentCardIndex];
  if (!card) return;

  const textToRead = `${card.title}. ${card.vignette}`;
  const utterance = new SpeechSynthesisUtterance(textToRead);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  window.speechSynthesis.speak(utterance);
  showToast("Reading clinical scenario aloud 🔊");
}

// ----------------------------------------------------
// KEYBOARD SHORTCUTS
// ----------------------------------------------------

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ignore keystrokes when typing inside input boxes
    if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

    if (e.code === "Space") {
      e.preventDefault();
      toggleRevealAnswers();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      nextCard();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      prevCard();
    }
  });
}
