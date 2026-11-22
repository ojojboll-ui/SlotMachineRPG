import { startApp } from './ui/app.js';

try { startApp(); }
catch (e) { console.error(e); const f = document.getElementById('fail'); f.hidden = false; f.querySelector('p').textContent = 'The game could not start: ' + e.message; }
