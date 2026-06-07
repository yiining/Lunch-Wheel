const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRzU4AWemqJ8Xg-WEnKWiyPFATpZB3fuU9idI06A1r2SSn9rHGeB7T1C9QpsfMf86E9G8MjCJL3r_Ah/pub?output=csv';

window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('splash');
  const mainPg = document.querySelector('.main-pg');

  
  if (mainPg) mainPg.style.opacity = '0';

  setTimeout(() => {
    if (splash) {
      splash.classList.add('hide');
      
      if (mainPg) {
        mainPg.style.transition = 'opacity 0.8s ease';
        mainPg.style.opacity = '1';
      }

      splash.addEventListener('animationend', () => {
        splash.style.display = 'none';
      }, { once: true });
    }
  }, 2000);
});

const COLOR_POOL = [
  '#fca0a0', '#ffda47', '#8fe3c4',
  '#8f9ae3', '#fc9a69', '#d6a7fa',
  '#48CAE4', '#ff6161'
];

let allRestaurants = [];
let categories     = [];
let currentCategory = '';
let usedRestaurants = [];
let currentAngle   = 0;
let isSpinning     = false;

const wheel       = document.getElementById('wheel');
const ctx          = wheel.getContext('2d');
const spinBtn      = document.getElementById('spinBtn');
const syncBtn      = document.getElementById('syncBtn');
const loadingMsg   = document.getElementById('loadingMsg');
const wheelWrp     = document.getElementById('wheelWrp');
const resWdw      = document.getElementById('resWdw');
const resCategory = document.getElementById('resCategory');
const resName    = document.getElementById('resName');
const resInfo    = document.getElementById('resInfo');
const linkUber      = document.getElementById('linkUber');
const linkPanda     = document.getElementById('linkPanda');
const linkOther     = document.getElementById('linkOther');
const btnRespin    = document.getElementById('btnRespin');
const btnConfirm   = document.getElementById('btnConfirm');

function parseCSV(text) {
  if (!text) return [];
  
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) return [];

  // 去空格、轉小寫
  const headers = splitCSVLine(lines[0]).map(h => 
    (h || '').replace(/^\uFEFF/, '').trim().replace(/\s+/g, '').toLowerCase()
  );

  return lines.slice(1).map(line => {
    const values = splitCSVLine(line);
    const row = {};
    
    headers.forEach((h, i) => {
      if (!h) return;
      let val = values[i] !== undefined ? values[i] : '';
      row[h] = val.replace(/[\r\n]+/g, '').trim();
    });
    return row;
  }).filter(row => {
    const nameVal = (row['餐廳名稱'] || row['restaurantname'] || row['name'] || '').trim();
    return nameVal && nameVal !== '-' && nameVal !== '';
  });
}

function splitCSVLine(line) {
  if (!line) return [];
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function extractCategories(restaurants) {
  const set = new Set();
  restaurants.forEach(r => {
    const tags = r['品類標籤'] || r['tags'] || r['category'] || '';
    tags.split(',').forEach(tag => {
      const t = tag.trim();
      if (t && t !== '-') set.add(t);
    });
  });
  return [...set];
}

function getRestaurantsByCategory(category) {
  return allRestaurants.filter(r => {
    const tagsField = r['品類標籤'] || r['tags'] || r['category'] || '';
    const tags = tagsField.split(',').map(t => t.trim());
    return tags.includes(category);
  });
}

function pickRandom(arr, excludes = []) {
  const nameKey = arr[0] && arr[0]['餐廳名稱'] ? '餐廳名稱' : (arr[0] && arr[0]['name'] ? 'name' : Object.keys(arr[0] || {})[0]);
  const available = arr.filter(r => !excludes.includes(r[nameKey]));
  if (available.length === 0) {
    usedRestaurants = [];
    return arr[Math.floor(Math.random() * arr.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function val(str) {
  return (!str || str === '-') ? null : str;
}

function drawWheel(angle) {
  if (categories.length === 0) return;
  const total   = categories.length;
  const arcSize = (2 * Math.PI) / total;
  const cx      = 140;
  const cy      = 140;
  const radius  = cx - 4;

  ctx.clearRect(0, 0, 280, 280);

    categories.forEach((cat, i) => {
    const startAngle = angle + i * arcSize - Math.PI / 2;
    const endAngle   = startAngle + arcSize;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = COLOR_POOL[i % COLOR_POOL.length];
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 3;
    ctx.stroke();

    ctx.save();
    const midAngle = startAngle + arcSize / 2;
    const textX    = cx + (radius * 0.66) * Math.cos(midAngle);
    const textY    = cy + (radius * 0.66) * Math.sin(midAngle);
    ctx.translate(textX, textY);
    ctx.rotate(midAngle + Math.PI / 2);
    ctx.fillStyle    = '#ffffff';
    ctx.font         = 'bold 14px "Noto Sans TC", sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cat, 0, 0);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, 2 * Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function getResultCategory(finalAngle) {
    const total      = categories.length;
    const arcSize    = (2 * Math.PI) / total;
    const normalized = ((-finalAngle) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const index = Math.floor(normalized / arcSize) % total;
    return categories[index];
}

function showRestaurant(category) {
    const pool      = getRestaurantsByCategory(category);
    const restaurant = pickRandom(pool, usedRestaurants);

    if (!restaurant) return;

    const nameKey = restaurant['餐廳名稱'] ? '餐廳名稱' : 'name';
    usedRestaurants.push(restaurant[nameKey]);
    resCategory.textContent = category;
    resName.textContent = restaurant[nameKey];
    resInfo.innerHTML = '';

    function addRow(icon, text) {
        if (!val(text)) return;
        const row = document.createElement('div');
        row.className = 'info-row';
        row.innerHTML = `<span class="icon">${icon}</span><span>${text}</span>`;
        resInfo.appendChild(row);
    }

    addRow('💰', restaurant['價格區間'] || restaurant['pricefield'] || restaurant['price']);
    addRow('⭐', restaurant['評分'] || restaurant['rate']);
    addRow('📝', restaurant['備註'] || restaurant['note']);

    const uberLink = val(restaurant['優食連結']);
    if (linkUber) {
        if (uberLink) {
        linkUber.href = uberLink;
        linkUber.classList.remove('hidden');
        } else {
        linkUber.classList.add('hidden');
        }
    }

    const pandaLink = val(restaurant['熊貓連結']);
    if (linkPanda) {
      if (pandaLink) {
        linkPanda.href = pandaLink;
        linkPanda.classList.remove('hidden');
      } else {
        linkPanda.classList.add('hidden');
      }
    }

    const otherLink = val(restaurant['其他連結']);
    if (linkOther) {
        if (otherLink) {
        linkOther.href = otherLink;
        linkOther.classList.remove('hidden');
        } else {
        linkOther.classList.add('hidden');
        }
    }
  
    const resDeliveryGroup = document.getElementById('resDeliveryGroup');
    if (resDeliveryGroup) {
    resDeliveryGroup.style.display = (uberLink || pandaLink || otherLink) ? 'flex' : 'none';
    }

    resWdw.classList.add('show');
}

function spin() {
  if (isSpinning) return;
  isSpinning = true;
  spinBtn.disabled = true;

  const extraSpins  = (5 + Math.random() * 3) * 2 * Math.PI;
  const randomStop  = Math.random() * 2 * Math.PI;
  const targetAngle = currentAngle - extraSpins - randomStop;

  const startAngle = currentAngle;
  const startTime  = performance.now();
  const duration   = 3000;

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function animate(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    currentAngle   = startAngle + (targetAngle - startAngle) * easeOut(progress);

    drawWheel(currentAngle);

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      currentAngle = targetAngle;
      isSpinning   = false;
      currentCategory = getResultCategory(currentAngle);
      usedRestaurants = [];
      setTimeout(() => { showRestaurant(currentCategory); }, 500);
    }
  }
  requestAnimationFrame(animate);
}

function closeModal() {
  resWdw.classList.remove('show');
  spinBtn.disabled = false;
}

if (btnRespin) btnRespin.addEventListener('click', () => { showRestaurant(currentCategory); });
if (btnConfirm) btnConfirm.addEventListener('click', closeModal);
if (resWdw) resWdw.addEventListener('click', (e) => { if (e.target === resWdw) closeModal(); });

async function loadData(forceRefresh = false) {
  if (syncBtn) {
    syncBtn.style.display = 'block';
  }

  try {
    let text = '';
    const cachedData = localStorage.getItem('restaurant_csv_data');
    
    if (cachedData && !forceRefresh) {
      text = cachedData;
    } else {
      if (forceRefresh && syncBtn) {
        syncBtn.disabled = true;
        syncBtn.textContent = 'syncing...';
      }
      const res = await fetch(CSV_URL + '&t=' + Date.now());
      text = await res.text();
      localStorage.setItem('restaurant_csv_data', text);
    }

    allRestaurants = parseCSV(text);          
    categories     = extractCategories(allRestaurants);

    if (categories.length === 0) {
      loadingMsg.textContent = 'category cannont be found, please sync the latest data.';
      if (wheelWrp) wheelWrp.style.display = 'none';
      if (spinBtn) spinBtn.style.display = 'none';
      return;
    }

    if (loadingMsg) loadingMsg.style.display = 'none';
    if (wheelWrp) wheelWrp.style.display   = 'block';
    if (spinBtn) spinBtn.style.display    = 'block';
    
    wheel.width = 840;
    wheel.height = 840;
    ctx.scale(3, 3);

    drawWheel(currentAngle);
    initRecommendPage();     
    
    if (spinBtn) {
      spinBtn.removeEventListener('click', spin);
      spinBtn.addEventListener('click', spin);
    }

    if (forceRefresh && syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'sync successful!';
      setTimeout(() => { syncBtn.textContent = 'sync the latest data'; }, 2000);
    }

  } catch (err) {
    if (loadingMsg) loadingMsg.textContent = 'Data loading failed, please try again later.';
    console.error(err);
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.textContent = 'sync failed, try again';
    }
  }
}

loadData();

if (syncBtn) {
  syncBtn.addEventListener('click', () => { loadData(true); });
}

const WRITE_URL = 'https://script.google.com/macros/s/AKfycbz59UPMq6BzF4abP2II0SiGRc8xo9uiA4vvxbfX1Qxsf7ulJdqtgYr-4FUCc6kpzetBig/exec';

function initRecommendPage() {
  const tagGroup   = document.getElementById('tagGroup');
  const recPage    = document.getElementById('recommendPg');
  const recBtn     = document.getElementById('recommendBtn');
  const recBack    = document.getElementById('recBack');
  const recClear   = document.getElementById('recClear');
  const recSubmit  = document.getElementById('recSubmit');
  const submitMsg  = document.getElementById('submitMsg');
  const errName    = document.getElementById('err-name');
  const starGroup  = document.getElementById('starGroup');

  if (!tagGroup || !recPage) return;

  let selectedTags  = [];
  let selectedPrice = '';
  let selectedStar  = 0;

  tagGroup.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'tag-btn';
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      if (selectedTags.includes(cat)) {
        selectedTags = selectedTags.filter(t => t !== cat);
        btn.classList.remove('selected');
      } else {
        selectedTags.push(cat);
        btn.classList.add('selected');
      }
    });
    tagGroup.appendChild(btn);
  });

  document.querySelectorAll('.price-btn').forEach(btn => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
      newBtn.classList.add('selected');
      selectedPrice = newBtn.dataset.val;
    });
  });

  document.querySelectorAll('.star').forEach(star => {
    const newStar = star.cloneNode(true);
    star.parentNode.replaceChild(newStar, star);
    newStar.addEventListener('click', () => {
      selectedStar = parseInt(newStar.dataset.val);
      document.querySelectorAll('.star').forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= selectedStar);
      });
    });
  });

  if (recBtn) {
    recBtn.removeEventListener('click', () => {});
    recBtn.addEventListener('click', () => { recPage.classList.add('open'); });
  }
  if (recBack) {
    recBack.removeEventListener('click', () => {});
    recBack.addEventListener('click', () => { recPage.classList.remove('open'); });
  }

  if (recClear) {
    recClear.addEventListener('click', () => {
      const fields = ['rec-name', 'uber-delivery', 'panda-delivery', 'other-delivery', 'rec-note'];
      fields.forEach(f => {
        const el = document.getElementById(f);
        if (el) el.value = '';
      });

      selectedTags  = [];
      selectedPrice = '';
      selectedStar  = 0;

      document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('selected'));
      document.querySelectorAll('.price-btn').forEach(b => b.classList.remove('selected'));
      document.querySelectorAll('.star').forEach(b => b.classList.remove('active'));

      if (submitMsg) { submitMsg.textContent = ''; submitMsg.className = 'submit-msg'; }
      if (errName) errName.classList.remove('show');
    });
  }

  if (recSubmit) {
    const newRecSubmit = recSubmit.cloneNode(true);
    recSubmit.parentNode.replaceChild(newRecSubmit, recSubmit);
    
    newRecSubmit.addEventListener('click', async () => {
      const nameEl = document.getElementById('rec-name');
      const name = nameEl ? nameEl.value.trim() : '';

      if (!name) {
        if (errName) errName.classList.add('show');
        if (nameEl) nameEl.focus();
        return;
      }
      if (errName) errName.classList.remove('show');

      const payload = {
        '餐廳名稱': name,
        '品類標籤': selectedTags.join(','),
        '價格區間': selectedPrice,
        '評分':     selectedStar || '',
        '優食連結': document.getElementById('uber-delivery').value.trim(),
        '熊貓連結': document.getElementById('panda-delivery').value.trim(),
        '其他連結': document.getElementById('other-delivery').value.trim(),
        '備註':     document.getElementById('rec-note').value.trim()
      };

      newRecSubmit.disabled = true;
      if (submitMsg) { submitMsg.textContent = 'submitting...'; 
        submitMsg.className = 'submit-msg'; }

      try {
        await fetch(WRITE_URL, {
          method: 'POST',
          mode:   'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body:   JSON.stringify(payload)
        });

        if (submitMsg) { submitMsg.textContent = 'Submission successful, THANK TOU for your recommendation!!'; submitMsg.className = 'submit-msg success'; }

        setTimeout(() => {
          if (recClear) recClear.click();
          recPage.classList.remove('open');
          newRecSubmit.disabled = false;
        }, 1500);

      } catch (err) {
        if (submitMsg) { submitMsg.textContent = 'Submission failed, please try again later.'; submitMsg.className = 'submit-msg error'; }
        newRecSubmit.disabled = false;
      }
    });
  }
}


// Feedback
(function () {
  const feedbackBtn    = document.getElementById('feedbackBtn');
  const feedbackWdw    = document.getElementById('feedbackWdw');
  const feedbackClose  = document.getElementById('feedbackClose');
  const feedbackSubmit = document.getElementById('feedbackSubmit');
  const feedbackText   = document.getElementById('feedbackText');
  const feedbackMsg    = document.getElementById('feedbackMsg');

  feedbackBtn.addEventListener('click', () => {
    feedbackWdw.classList.add('show');
  });

  function closeFeedback() {
    feedbackWdw.classList.remove('show');
    feedbackText.value    = '';
    feedbackMsg.textContent = '';
    feedbackMsg.className = 'submit-msg';
    feedbackSubmit.disabled = false;
  }

  feedbackClose.addEventListener('click', closeFeedback);
  feedbackWdw.addEventListener('click', (e) => {
    if (e.target === feedbackWdw) closeFeedback();
  });

  feedbackSubmit.addEventListener('click', async () => {
    const text = feedbackText.value.trim();
    if (!text) return;

    feedbackSubmit.disabled   = true;
    feedbackMsg.textContent   = 'Submitting...';
    feedbackMsg.className     = 'submit-msg';

    try {
      await fetch(WRITE_URL, {
        method: 'POST',
        mode:   'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body:   JSON.stringify({ sheet: 'Feedbacks', '時間': new Date().toLocaleString('zh-TW'), '內容': text })
      });

      feedbackMsg.textContent = 'Submitted, thank you!';
      feedbackMsg.className   = 'submit-msg success';
      setTimeout(closeFeedback, 1500);

    } catch (err) {
      feedbackMsg.textContent = 'Failed, please try again.';
      feedbackMsg.className   = 'submit-msg error';
      feedbackSubmit.disabled = false;
    }
  });
})();