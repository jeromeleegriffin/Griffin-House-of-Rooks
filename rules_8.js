/* House of Rooks — extracted module | Author: Jerome Griffin */
/* rules: deck helpers, compare, legal plays */
function isRed2(card) {
  return card && card.id === 'red-2';
}

function effectiveRank(card) {
  // Numeric rank for ordering within a color (higher wins unless rookLowest etc.)
  if (!card) return 0;
  if (card.color === 'rook') return rookLowest ? -1 : 1000;
  if (isRed1(card)) return 1001; // always above 14s
  if (isRed2(card)) return 999;
  if (onesHigh && card.rank === 1) return 15; // 1 ranks above 14
  return card.rank;
}

function makeDeck() {
  const deck = [];
  for (const c of COLORS) {
    for (const r of RANKS) {
      deck.push({ color: c, rank: r, id: `${c}-${r}` });
    }
    if (includeOnes) {
      deck.push({ color: c, rank: 1, id: `${c}-1` });
    }
  }
  if (includeRed2) {
    deck.push({ color: 'red', rank: 2, id: 'red-2' });
  }
  if (includeRed1) {
    // Distinct from ones-high normal red 1 (id "red-1")
    deck.push({ color: 'red', rank: 1, id: 'red1-special', specialRed1: true });
  }
  if (includeRook) {
    deck.push({ color: 'rook', rank: 99, id: 'rook' });
  }
  return deck;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function cardPoints(card) {
  if (!card) return 0;
  if (card.color === 'rook' || card.id === 'rook') return 20;
  if (isRed1(card)) return 30;
  if (isRed2(card) || card.id === 'red-2') return parseInt(red2Points, 10) || 20;
  // Normal ones (including red-1 when includeOnes) are 15 pts, not permanent trump
  if (card.rank === 1 || card.rank === '1') return includeOnes ? 15 : 0;
  const r = parseInt(card.rank, 10);
  return POINT_VALUES[r] || 0;
}

/** Modern Rook faces: large center rank, single upright color word underneath */
function cardColorWord(card) {
  if (!card) return '';
  if (card.color === 'rook' || card.id === 'rook') return 'rook';
  if (isRed2(card)) return 'trump';
  if (isRed1(card)) return 'trump';
  return String(card.color || '');
}

/** Red 2 art: try Red2.png → Red2.webp → Red2.jpg → plain text face (no broken icon) */
window.__red2ImgError = function (img) {
  if (!img) return;
  const step = img.dataset.fallback || '1';
  if (step === '1') {
    img.dataset.fallback = '2';
    img.src = 'Red2.webp?v=48';
    return;
  }
  img.onerror = null;
  const parent = img.parentElement;
  if (parent) {
    parent.className = 'c-stack';
    parent.innerHTML = '<div class="c-bar top"></div><div class="c-num">2</div><div class="c-color">trump</div><div class="c-bar bot"></div>';
  }
  const face = parent && parent.closest('.card-face');
  if (face) face.classList.remove('red2-art');
};

function cardInnerHTML(card) {
  if (card.color === 'rook' || card.id === 'rook') {
    return `
      <div class="c-stack rook-stack">
        <img class="rook-bird-img" src="Rook.png" alt="Rook" draggable="false"
          onerror="this.style.display='none'">
      </div>
    `;
  }
  if (isRed2(card)) {
    // Special full-bleed art only when Red 2 is permanent trump (includeRed2).
    // Image file must be in the same folder as index.html: Red2.png (or .webp / .jpg).
    if (includeRed2) {
      return `
        <div class="c-stack red2-stack">
          <img class="red2-img" src="Red2.png?v=48" alt="Red 2 Trump" draggable="false"
            data-fallback="1" onerror="window.__red2ImgError&&window.__red2ImgError(this)">
        </div>
      `;
    }
    return `
      <div class="c-bar top"></div>
      <div class="c-stack">
        <div class="c-num">2</div>
        <div class="c-color">red</div>
      </div>
      <div class="c-bar bot"></div>
    `;
  }
  if (isRed1(card)) {
    return `
      <div class="c-bar top"></div>
      <div class="c-stack">
        <div class="c-num">1</div>
        <div class="c-color">trump</div>
      </div>
      <div class="c-bar bot"></div>
    `;
  }
  const rank = card.rank;
  const color = cardColorWord(card);
  return `
    <div class="c-bar top"></div>
    <div class="c-stack">
      <div class="c-num">${rank}</div>
      <div class="c-color">${color}</div>
    </div>
    <div class="c-bar bot"></div>
  `;
}

function isPermanentTrump(card) {
  // Rook always; Red 2 only when rules include it as permanent trump; Red 1 when included
  if (!card) return false;
  if (card.color === 'rook' || card.id === 'rook') return !!includeRook;
  if (isRed2(card)) return !!includeRed2;
  if (isRed1(card)) return !!includeRed1;
  return false;
}

function compareCards(a, b, ledColor, trump) {
  // Returns >0 if a beats b
  const aIsTrump = isPermanentTrump(a) || a.color === trump;
  const bIsTrump = isPermanentTrump(b) || b.color === trump;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;

  if (aIsTrump && bIsTrump) {
    // Special ranking among permanent / trump cards
    // Highest order when rook is high: Red1 > Rook > Red2 > normal trump by rank
    // When rookLowest: Red1 > Red2 > normal trump by rank > Rook
    if (rookLowest) {
      if (isRed1(a) && !isRed1(b)) return 1;
      if (isRed1(b) && !isRed1(a)) return -1;
      if (isRed2(a) && !isRed2(b) && b.color !== 'rook') return 1;
      if (isRed2(b) && !isRed2(a) && a.color !== 'rook') return -1;
      if (a.color === 'rook') return -1;
      if (b.color === 'rook') return 1;
      return effectiveRank(a) - effectiveRank(b);
    }
    // Rook high (default)
    if (isRed1(a)) return 1;
    if (isRed1(b)) return -1;
    if (a.color === 'rook') return 1;
    if (b.color === 'rook') return -1;
    if (isRed2(a)) return 1;
    if (isRed2(b)) return -1;
    return effectiveRank(a) - effectiveRank(b);
  }

  if (a.color === ledColor && b.color !== ledColor) return 1;
  if (a.color !== ledColor && b.color === ledColor) return -1;
  if (a.color === ledColor && b.color === ledColor) return effectiveRank(a) - effectiveRank(b);
  return 0;
}




function isSpecialCard(card) {
  // Permanent-trump specials only when those rules are on
  if (!card) return false;
  if (card.color === 'rook' || card.id === 'rook') return !!includeRook;
  if (isRed2(card)) return !!includeRed2;
  if (isRed1(card)) return !!includeRed1;
  return false;
}

function isTrumpCard(card, trump) {
  if (!card) return false;
  if (isSpecialCard(card)) return true;
  return trump && card.color === trump;
}

/** True if card follows the led suit.
 *  - Normal cards of ledColor always follow.
 *  - Permanent specials (Rook / Red 2 / special Red 1) follow ONLY when trump is led
 *    (they are permanent trumps, so they count as following a trump lead).
 *  - When a non-trump color is led, specials do NOT count as that suit
 *    (having only Red 2 does not mean you "have red").
 */
function followsLedSuit(card, ledColor, trump) {
  if (!card || !ledColor) return false;
  if (isSpecialCard(card)) {
    // Specials follow a trump lead; they never "follow" a plain color lead
    return !!(trump && ledColor === trump);
  }
  return card.color === ledColor;
}

function canPlay(card, hand, ledColor, trump) {
  // Lead anything
  if (!ledColor) return true;

  // Optional: Rook / Red 1 / Red 2 anytime
  if (specialsAnytime && isSpecialCard(card)) return true;

  // Must-follow: normal suit cards of led color, PLUS permanent trumps when trump is led.
  // This makes Red 2 / Rook playable (and required if they are the only "trump") when someone leads trump.
  const hasLedColor = hand.some(c => followsLedSuit(c, ledColor, trump));

  if (hasLedColor) {
    return followsLedSuit(card, ledColor, trump);
  }

  // Void of led color. Must play a trump if the rule is on and you have one.
  // isTrumpCard already treats Red 2 / Rook / special Red 1 as trump.
  const hasTrump = hand.some(c => isTrumpCard(c, trump));
  if (mustTrumpWhenVoid && hasTrump) {
    return isTrumpCard(card, trump);
  }

  // Free: any card
  return true;
}

