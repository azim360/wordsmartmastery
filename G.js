function renderCard() {
  const card = activeCard();
  const total = current.cards.length;

  updateProgress();

  el('#nav-prev').disabled = current.pos === 0;
  el('#nav-next').disabled = current.pos === total - 1;

  const cardEl = el('#card-el');
  if (current.flipped) {
    // Snap back to front instantly to prevent flashing the new word on the back
    cardEl.style.transition = 'none';
    cardEl.classList.remove('flipped');
    current.flipped = false;
    void cardEl.offsetWidth; // Force reflow
    cardEl.style.transition = ''; // Restore standard CSS transition
  } else {
    cardEl.classList.remove('flipped');
    current.flipped = false;
  }

  el('#card-seq').textContent = `#${card.seq}`;
  el('#card-word').textContent = card.word;
  el('#card-back-word').textContent = card.word;

  const dot = el('#card-status-dot');
  dot.className = 'card-status-dot';
  const st = current.status[card.seq];
  if (st) dot.classList.add(st);

  const img = el('#card-back-img');
  // Hide the image while loading to ensure the old image never displays with the new word
  img.style.display = 'none';
  img.onload = () => { img.style.display = 'block'; };
  img.src = getDriveImageLink(card.id);
  img.onerror = () => { 
    img.onerror = null; 
    img.src = FALLBACK_IMG; 
    img.style.display = 'block'; 
  };

  el('#judge-row').classList.toggle('hidden', false);
}