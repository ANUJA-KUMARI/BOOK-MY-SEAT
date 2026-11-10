import { initCommon } from '../components.js';
import { getParam } from '../utils.js';

initCommon();

// textContent (not innerHTML) keeps URL parameters from injecting markup.
const feature = (getParam('feature') || 'This feature').slice(0, 60);
const phase = (getParam('phase') || '').replace(/\D/g, '').slice(0, 2);
document.title = `${feature} | BOOK_MY_SEAT`;
document.getElementById('cs-feature').textContent = `${feature} is not built yet`;
document.getElementById('cs-phase').textContent = phase
  ? `It is planned for Phase ${phase} of the project. This Phase 2 build covers browsing movies and choosing a showtime.`
  : 'It is planned for a later phase. This Phase 2 build covers browsing movies and choosing a showtime.';
