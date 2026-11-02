/* =========================================================
   Avisos flotantes (toast)
   ========================================================= */
(() => {
  let timer;
  App.toast = (msg, ms = 3200) => {
    const t = App.$('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => t.classList.remove('show'), ms);
  };
})();
