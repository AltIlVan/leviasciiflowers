import { BouquetEngine } from './bouquet3d.js';
import { sound } from './audio.js';

// Calculate exact days between October 21, 2024 and current time
function calculateDaysTogether() {
  const startDate = new Date(2024, 9, 21); // Month 9 is October (0-indexed)
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - startDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

document.addEventListener('DOMContentLoaded', () => {
  const termStream = document.getElementById('term-stream');
  const prologueFooter = document.getElementById('prologue-footer');
  const btnToStudio = document.getElementById('btn-to-studio');
  const viewPrologue = document.getElementById('view-prologue');
  const viewStudio = document.getElementById('view-studio');
  const canvas = document.getElementById('bouquet-canvas');
  const btnAudio = document.getElementById('btn-audio');
  const sysClock = document.getElementById('sys-clock');

  // Modal elements
  const modalLetter = document.getElementById('modal-letter');
  const btnRevealLetter = document.getElementById('btn-reveal-letter');
  const btnCloseLetter = document.getElementById('btn-close-letter');

  // Clock in terminal header
  function updateClock() {
    const d = new Date();
    sysClock.textContent = d.toTimeString().split(' ')[0];
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Audio Toggle
  btnAudio.addEventListener('click', () => {
    sound.init();
    const muted = sound.toggleMute();
    btnAudio.textContent = muted ? '🔇' : '🔊';
  });

  // Ensure AudioContext starts on first interaction
  window.addEventListener('click', () => {
    sound.init();
    sound.startAmbientMusic();
  }, { once: true });

  window.addEventListener('touchstart', () => {
    sound.init();
    sound.startAmbientMusic();
  }, { once: true });

  // Initialize Bouquet 3D Engine
  const engine = new BouquetEngine(canvas, {
    message: "for you Levina ♥",
    state: {
      flowerType: 'mixed',
      flowerCount: 10,
      hasBabyBreath: true,
      hasSparkles: true,
      hasHearts: true,
      wrapColor: 'kraft',
      ribbonColor: 'red'
    }
  });

  function resizeCanvas() {
    engine.resize();
  }
  window.addEventListener('resize', resizeCanvas);

  // --- STORY TYPING SEQUENCE ---
  const daysMet = calculateDaysTogether();

  const storyScript = [
    { type: 'cmd', text: '> counting the days since we met...' },
    { 
      type: 'counter', 
      label: 'Kita sudah kenal selama:', 
      days: daysMet, 
      unit: 'hari.' 
    },
    { type: 'cmd', text: '> retrieving record...' },
    { type: 'text', text: 'Dan ini kali ketiga kita lalui ini bersama-sama.\n\nWaktu ternyata berjalan cukup jauh, ya.' },
    { type: 'cmd', text: '> note_to_self.txt' },
    { type: 'text', text: 'Aku bersyukur bisa melalui semua ini bersamamu.\n\nDan, lebih dari itu, aku bersyukur pernah bertemu kamu.' },
    { type: 'cmd', text: '> hypothetical scenario detected' },
    { type: 'text', text: 'Kalau aku bisa mengulang semuanya,\n\nbahkan jika aku sudah tahu akan seperti apa kita melewatinya,\n\naku tetap akan memilih yang sama.' },
    { type: 'cmd', text: '> searching alternate universes...' },
    { type: 'text', text: 'Dan kalau memang ada semesta lain,\n\naku harap pertemuan kita juga tetap semanis ini.\n\nKalau boleh, bahkan sedikit lebih baik.' },
    { type: 'cmd', text: '> end of record_03' },
    { 
      type: 'highlight', 
      text: 'Selamat ulang tahun, Levina.\n\nOne of the most important strings in my life.' 
    },
    { type: 'cmd', text: '> preparing something for you...\n> [01] a flower, for you.' }
  ];

  let currentBlockIndex = 0;

  function typeText(element, text, speed = 25, onComplete) {
    let i = 0;
    const interval = setInterval(() => {
      element.textContent += text[i];
      if (i % 3 === 0) sound.playTypeSound();
      i++;
      termStream.scrollTop = termStream.scrollHeight;
      if (i >= text.length) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, speed);
  }

  function runNextStoryBlock() {
    if (currentBlockIndex >= storyScript.length) {
      prologueFooter.style.display = 'block';
      sound.playChime(659.25); // E5 chime
      return;
    }

    const item = storyScript[currentBlockIndex];
    currentBlockIndex++;

    if (item.type === 'cmd') {
      const p = document.createElement('div');
      p.className = 'term-cmd';
      termStream.appendChild(p);
      typeText(p, item.text, 22, () => {
        setTimeout(runNextStoryBlock, 500);
      });
    } else if (item.type === 'counter') {
      const box = document.createElement('div');
      box.className = 'term-counter-box';
      box.innerHTML = `<div>${item.label}</div><div class="counter-days">0</div><div>${item.unit}</div>`;
      termStream.appendChild(box);
      termStream.scrollTop = termStream.scrollHeight;

      sound.playChime(523.25);

      // Animate counting up
      const counterEl = box.querySelector('.counter-days');
      let currentVal = 0;
      const targetVal = item.days;
      const step = Math.max(1, Math.floor(targetVal / 35));
      const countTimer = setInterval(() => {
        currentVal += step;
        if (currentVal >= targetVal) {
          currentVal = targetVal;
          clearInterval(countTimer);
          setTimeout(runNextStoryBlock, 800);
        }
        counterEl.textContent = currentVal.toLocaleString('id-ID');
      }, 30);
    } else if (item.type === 'highlight') {
      const p = document.createElement('div');
      p.className = 'term-text term-highlight';
      termStream.appendChild(p);
      sound.playChime(587.33); // D5 chime
      typeText(p, item.text, 35, () => {
        setTimeout(runNextStoryBlock, 900);
      });
    } else {
      const p = document.createElement('div');
      p.className = 'term-text';
      termStream.appendChild(p);
      typeText(p, item.text, 28, () => {
        setTimeout(runNextStoryBlock, 750);
      });
    }
  }

  // Start story typing after subtle fade in
  setTimeout(() => {
    runNextStoryBlock();
  }, 600);

  // Transition from Prologue to 3D Bouquet Studio with Bloom
  btnToStudio.addEventListener('click', () => {
    sound.playTap();
    viewPrologue.classList.add('view-hidden');
    setTimeout(() => {
      viewPrologue.style.display = 'none';
      viewStudio.classList.remove('view-hidden');
      resizeCanvas();
      
      // Start Bloom Animation!
      engine.bloomProgress = 0.0;
      engine.start();
      engine.triggerBloom(() => {
        sound.playChime(783.99); // G5 chime when fully blossomed
      });
      sound.playChime(523.25); // initial opening chime
    }, 700);
  });

  // Re-bloom Button in Spin Tab
  const btnRebloom = document.getElementById('btn-rebloom');
  if (btnRebloom) {
    btnRebloom.addEventListener('click', () => {
      sound.playTap();
      engine.triggerBloom(() => {
        sound.playChime(783.99);
      });
    });
  }

  // --- STUDIO CONTROLS & GAMEPLAY ---
  
  // Tab Switcher
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      sound.playTap();
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = btn.getAttribute('data-tab');
      document.getElementById(target).classList.add('active');
    });
  });

  // Flower Type Selection
  const flowerChips = document.querySelectorAll('[data-type]');
  flowerChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playTap();
      flowerChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      engine.updateConfig({ flowerType: chip.getAttribute('data-type') });
    });
  });

  // Flower Count Inc / Dec
  const countDisplay = document.getElementById('flower-count-display');
  document.getElementById('btn-count-inc').addEventListener('click', () => {
    if (engine.state.flowerCount < 14) {
      sound.playTap();
      engine.updateConfig({ flowerCount: engine.state.flowerCount + 1 });
      countDisplay.textContent = engine.state.flowerCount;
    }
  });
  document.getElementById('btn-count-dec').addEventListener('click', () => {
    if (engine.state.flowerCount > 6) {
      sound.playTap();
      engine.updateConfig({ flowerCount: engine.state.flowerCount - 1 });
      countDisplay.textContent = engine.state.flowerCount;
    }
  });

  // Toggle Switches (Fillers)
  function setupToggle(elementId, configKey) {
    const el = document.getElementById(elementId);
    el.addEventListener('click', () => {
      sound.playTap();
      const isActive = el.classList.toggle('on');
      engine.updateConfig({ [configKey]: isActive });
    });
  }
  setupToggle('toggle-baby', 'hasBabyBreath');
  setupToggle('toggle-hearts', 'hasHearts');
  setupToggle('toggle-sparkles', 'hasSparkles');

  // Paper Wrap Selection
  const wrapChips = document.querySelectorAll('[data-wrap]');
  wrapChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playTap();
      wrapChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      engine.updateConfig({ wrapColor: chip.getAttribute('data-wrap') });
    });
  });

  // Ribbon Color Selection
  const ribbonChips = document.querySelectorAll('[data-ribbon]');
  ribbonChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playTap();
      ribbonChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      engine.updateConfig({ ribbonColor: chip.getAttribute('data-ribbon') });
    });
  });

  // Spin Toggle & Speed
  const toggleSpin = document.getElementById('toggle-spin');
  toggleSpin.addEventListener('click', () => {
    sound.playTap();
    engine.autoSpin = toggleSpin.classList.toggle('on');
  });

  const speedChips = document.querySelectorAll('[data-speed]');
  speedChips.forEach(chip => {
    chip.addEventListener('click', () => {
      sound.playTap();
      speedChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      engine.spinSpeed = parseFloat(chip.getAttribute('data-speed'));
    });
  });

  // Reveal Modal
  btnRevealLetter.addEventListener('click', () => {
    sound.playChime(659.25);
    modalLetter.classList.add('show');
  });

  const closeModal = () => {
    sound.playTap();
    modalLetter.classList.remove('show');
  };

  btnCloseLetter.addEventListener('click', closeModal);
  const btnCloseLetterTop = document.getElementById('btn-close-letter-top');
  if (btnCloseLetterTop) {
    btnCloseLetterTop.addEventListener('click', closeModal);
  }
});
