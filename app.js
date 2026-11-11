'use strict';
const $ = selector => document.querySelector(selector);
const KEY = 'bin-organizer-v1';
let db = {version: 1, bins: []};
let editing = null;
let pictures = [];
let storage;
const uid = () => crypto.randomUUID();
function message(text) { $('#status').textContent = text; }
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, handler, className = 'small') {
  const node = el('button', text, className); node.type = 'button'; node.onclick = handler; return node;
}
function validDate(value) {
  return value === '' || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value);
}
function validate(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.bins)) throw Error('Expected a version 1 Bin Organizer backup.');
  const ids = new Set();
  function record(value) {
    if (!value || typeof value.id !== 'string' || !value.id || ids.has(value.id) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 200) throw Error('The backup contains an invalid name or ID.');
    ids.add(value.id);
  }
  for (const bin of data.bins) {
    record(bin);
    if (bin.description !== undefined && (typeof bin.description !== 'string' || bin.description.length > 2000)) throw Error('A bin has an invalid description (maximum 2000 characters).');
    if (!Array.isArray(bin.items)) throw Error('A bin is missing its items.');
    for (const item of bin.items) {
      record(item);
      if (typeof item.date !== 'string' || !validDate(item.date) || !Array.isArray(item.pictures) || item.pictures.length > 10 || item.pictures.some(p => typeof p !== 'string' || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(p))) throw Error('An item has an invalid date or picture.');
    }
  }
  return data;
}
function openStore() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(KEY, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('inventory');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
function readStore() {
  return new Promise((resolve, reject) => {
    const req = storage.transaction('inventory').objectStore('inventory').get('db');
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error);
  });
}
async function commit(next) {
  if (!storage) throw Error('Browser storage is unavailable. Your change was not saved.');
  await new Promise((resolve, reject) => {
    const tx = storage.transaction('inventory', 'readwrite');
    tx.objectStore('inventory').put(next, 'db');
    tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error('Save interrupted.'));
  });
  db = next; render(); message('Saved in this browser.');
}
async function change(action) {
  try { const next = structuredClone(db); action(next); await commit(next); }
  catch (error) { message(`Could not save: ${error.message} Export a backup if storage is full.`); }
}
function showPicture(src, name) { $('#full-photo').src = src; $('#full-photo').alt = name; $('#photo-view').showModal(); }
function render() {
  const query = $('#search').value.trim().toLocaleLowerCase();
  const container = $('#bins'); container.replaceChildren();
  const total = db.bins.reduce((n, b) => n + b.items.length, 0);
  $('#stats').textContent = `${db.bins.length} bins · ${total} items`;
  for (const bin of db.bins) {
    const binMatch = bin.name.toLocaleLowerCase().includes(query) || (bin.description || '').toLocaleLowerCase().includes(query);
    const matches = bin.items.filter(item => binMatch || item.name.toLocaleLowerCase().includes(query));
    if (query && !binMatch && !matches.length) continue;
    const card = el('article', undefined, 'bin');
    const heading = el('div', undefined, 'bin-heading'); const title = el('div');
    title.append(el('h2', bin.name), el('p', `${bin.items.length} items`));
    if (bin.description) title.append(el('p', bin.description, 'bin-description'));
    const tools = el('div', undefined, 'bin-tools');
    tools.append(button('Edit', () => edit(bin.id)), button('Delete', () => {
      if (confirm(`Delete “${bin.name}” and all ${bin.items.length} items?`)) change(next => { next.bins = next.bins.filter(b => b.id !== bin.id); });
    }, 'small danger'));
    heading.append(title, tools); card.append(heading);
    const items = el('div', undefined, 'items');
    for (const item of matches) {
      const row = el('div', undefined, 'item'); const head = el('div', undefined, 'item-head'); const info = el('div');
      info.append(el('h3', item.name));
      if (item.date) { const date = el('time', new Date(`${item.date}T12:00:00`).toLocaleDateString()); date.dateTime = item.date; info.append(date); }
      const actions = el('div', undefined, 'item-actions');
      actions.append(button('Edit', () => edit(bin.id, item.id)), button('Delete', () => {
        if (confirm(`Delete “${item.name}” from “${bin.name}”?`)) change(next => { const b = next.bins.find(b => b.id === bin.id); b.items = b.items.filter(i => i.id !== item.id); });
      }, 'small danger')); head.append(info, actions); row.append(head);
      const photos = el('div', undefined, 'photos');
      item.pictures.forEach(src => { const img = el('img'); img.src = src; img.alt = item.name; img.loading = 'lazy'; const btn = button('', () => showPicture(src, item.name), 'photo-button'); btn.setAttribute('aria-label', `View picture of ${item.name}`); btn.append(img); photos.append(btn); });
      row.append(photos); items.append(row);
    }
    if (!bin.items.length) items.append(el('p', 'A little empty. Add your first item.', 'empty-bin'));
    card.append(items, button('+ Add item', () => edit(bin.id, null, true), 'add-item')); container.append(card);
  }
  if (!container.children.length) {
    const empty = el('div', undefined, 'empty'); empty.append(el('h2', query ? 'No matches found' : 'Give your things a home'), el('p', query ? 'Try another item or bin name.' : 'Create a bin, add what’s inside, and find it here whenever you need it.'));
    if (!query) empty.append(button('+ Create your first bin', () => edit(), 'primary')); container.append(empty);
  }
}
function renderPictures() {
  $('#photo-list').replaceChildren();
  pictures.forEach((src, index) => {
    const wrap = el('div', undefined, 'photo-edit'); const img = el('img'); img.src = src; img.alt = `Picture ${index + 1}`;
    wrap.append(img, button('Remove', () => { pictures.splice(index, 1); renderPictures(); })); $('#photo-list').append(wrap);
  });
}
function edit(binId = null, itemId = null, newItem = false) {
  editing = {binId, itemId, isItem: Boolean(itemId || newItem)};
  const bin = db.bins.find(b => b.id === binId); const item = bin?.items.find(i => i.id === itemId);
  $('#edit-form').reset(); $('#form-error').textContent = '';
  $('#editor-title').textContent = editing.isItem ? `${item ? 'Edit' : 'Add'} item · ${bin.name}` : `${bin ? 'Edit' : 'New'} bin`;
  $('#name').value = (editing.isItem ? item?.name : bin?.name) || '';
  $('#bin-fields').hidden = editing.isItem;
  $('#description').value = editing.isItem ? '' : (bin?.description || '');
  $('#date').value = item?.date || ''; pictures = [...(item?.pictures || [])]; renderPictures();
  $('#item-fields').hidden = !editing.isItem; $('#editor').showModal(); $('#name').focus();
}
async function resize(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('Choose JPEG, PNG or WebP files under 10 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg', .82);
  } finally { bitmap.close(); }
}
$('#edit-form').onsubmit = async event => {
  event.preventDefault(); const name = $('#name').value.trim();
  if (!name) { $('#form-error').textContent = 'Please enter a name.'; return; }
  const date = $('#date').value;
  if (editing.isItem && !validDate(date)) { $('#form-error').textContent = 'Please enter a valid date.'; return; }
  $('#save').disabled = true;
  try {
    const next = structuredClone(db);
    if (!editing.isItem) {
      const description = $('#description').value.trim();
      if (description.length > 2000) throw Error('Description must be at most 2000 characters.');
      if (editing.binId) Object.assign(next.bins.find(b => b.id === editing.binId), {name, description});
      else next.bins.push({id:uid(), name, description, items:[]});
    } else {
      const bin = next.bins.find(b => b.id === editing.binId); const item = {id:editing.itemId || uid(), name, date, pictures:[...pictures]};
      if (editing.itemId) bin.items[bin.items.findIndex(i => i.id === editing.itemId)] = item; else bin.items.push(item);
    }
    await commit(next); $('#editor').close();
  } catch(error) { $('#form-error').textContent = `Could not save: ${error.message}`; }
  finally { $('#save').disabled = false; }
};
$('#photos').onchange = async event => {
  const files = [...event.target.files]; $('#form-error').textContent = '';
  if (pictures.length + files.length > 10) { $('#form-error').textContent = 'Keep up to 10 pictures per item.'; event.target.value = ''; return; }
  $('#save').disabled = true; $('#photos').disabled = true;
  try { const converted = await Promise.all(files.map(resize)); pictures.push(...converted); renderPictures(); }
  catch(error) { $('#form-error').textContent = error.message; }
  finally { $('#save').disabled = false; $('#photos').disabled = false; event.target.value = ''; }
};
document.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => btn.closest('dialog').close());
$('#search').oninput = render; $('#add-bin').onclick = () => edit();
$('#export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], {type:'application/json'}));
  const a = el('a'); a.href = url; a.download = `bins-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); message('Backup exported, including pictures.');
};
$('#import').onclick = () => $('#import-file').click();
$('#import-file').onchange = async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    if (file.size > 100 * 1024 * 1024) throw Error('Backup is too large (maximum 100 MB).');
    const incoming = validate(JSON.parse(await file.text()));
    if (confirm(`Replace your current ${db.bins.length} bins with ${incoming.bins.length} imported bins? Export a backup first if you want to keep your current collection.`)) { await commit(incoming); message('Backup imported and saved in this browser.'); }
  } catch(error) { message(`Import failed: ${error.message} Your existing collection has not been replaced.`); }
  finally { event.target.value = ''; }
};
(async () => {
  try { storage = await openStore(); const saved = await readStore(); if (saved) db = validate(saved); }
  catch(error) { message(`Could not load browser storage: ${error.message} Avoid making changes until this is resolved.`); storage = null; }
  render();
})();
