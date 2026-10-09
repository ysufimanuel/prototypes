export function renderMinistries(items = [], limit = 6) {
  const escape = (value = '') => String(value).replace(/[&<>\"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  return items.slice(0, Number(limit) || 6).map((item) => {
    const leader = item.leader?.name ? `<p><strong>Pemimpin:</strong> ${escape(item.leader.name)}</p>` : '';
    const schedule = item.schedule ? `<p><strong>Jadwal:</strong> ${escape(item.schedule)}</p>` : '';
    return `<article class="ministry-card"><h3>${escape(item.name || 'Pelayanan')}</h3><p>${escape(item.description || '')}</p>${leader}${schedule}</article>`;
  }).join('');
}
