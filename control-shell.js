/* The navigation belongs to the document and can be used while WebGL opens. */
(() => {
  'use strict';
  const tabs = document.querySelector('.tabs');
  let userSelected = false;
  function select(name) {
    const selected = [...tabs.children].find(tab => tab.dataset.tab === name);
    if (!selected) return;
    for (const tab of tabs.children) {
      const active = tab === selected;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      document.getElementById(tab.dataset.tab).hidden = !active;
    }
    window.dispatchEvent(new CustomEvent('sphere-control-tab', { detail: name }));
  }
  tabs.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (!tab) return;
    if (tab.dataset.tab !== 'camera' && window.SphereStageFrame?.showMain() === false) return;
    userSelected = true;
    document.body.classList.remove('panel-hidden');
    select(tab.dataset.tab);
  });
  tabs.addEventListener('keydown', event => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const list = [...tabs.children], i = list.indexOf(event.target);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 :
      (i + (event.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length;
    list[next].click();
    list[next].focus();
  });
  const guide = document.getElementById('guide');
  document.getElementById('helpButton').onclick = () => guide.showModal();
  document.getElementById('closeGuide').onclick = () => guide.close();
  window.addEventListener('sphere-view-ready', () => {
    for (const tab of tabs.children) document.getElementById(tab.dataset.tab).inert = false;
    document.getElementById('controlStatus').hidden = true;
  }, { once: true });
  window.SphereControls = { select, get userSelected() { return userSelected; } };
})();
