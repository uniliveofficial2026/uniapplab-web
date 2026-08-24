const panels = document.querySelectorAll('.panel');
const navButtons = document.querySelectorAll('nav button[data-panel]');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    panels.forEach((p) => p.classList.remove('active'));
    document.getElementById(`panel-${btn.dataset.panel}`)?.classList.add('active');
    loadPanel(btn.dataset.panel);
  });
});

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  return res.json();
}

let builderSessionId = null;

async function loadTemplates() {
  const { templates } = await api('/api/templates');
  const select = document.querySelector('[data-testid="project-template-select"]');
  for (const t of templates || []) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    select.appendChild(opt);
  }
}

async function loadProjects() {
  const { projects } = await api('/api/projects');
  const list = document.getElementById('project-list');
  list.innerHTML = '';
  for (const p of projects || []) {
    const li = document.createElement('li');
    li.textContent = `${p.name} (${p.projectId})`;
    li.dataset.testid = `project-item-${p.projectId}`;
    list.appendChild(li);
  }
}

document.getElementById('create-project-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const body = { name: fd.get('name') };
  if (fd.get('template')) body.template = fd.get('template');
  await api('/api/projects', { method: 'POST', body: JSON.stringify(body) });
  await loadProjects();
  e.target.reset();
});

async function ensureBuilderSession(projectId) {
  if (builderSessionId) return builderSessionId;
  const { sessionId } = await api('/api/builder/sessions', {
    method: 'POST',
    body: JSON.stringify({ projectId, create: false }),
  });
  builderSessionId = sessionId;
  return sessionId;
}

async function refreshBuilderGraph() {
  if (!builderSessionId) return;
  const data = await api(`/api/builder/sessions/${builderSessionId}`);
  document.getElementById('builder-graph').textContent = JSON.stringify(data.graph, null, 2);
}

document.getElementById('builder-save').addEventListener('click', async () => {
  if (!builderSessionId) return;
  await api(`/api/builder/sessions/${builderSessionId}/save`, { method: 'POST', body: '{}' });
  await refreshBuilderGraph();
});

document.getElementById('builder-undo').addEventListener('click', async () => {
  if (!builderSessionId) return;
  await api(`/api/builder/sessions/${builderSessionId}/undo`, { method: 'POST', body: '{}' });
  await refreshBuilderGraph();
});

document.getElementById('builder-redo').addEventListener('click', async () => {
  if (!builderSessionId) return;
  await api(`/api/builder/sessions/${builderSessionId}/redo`, { method: 'POST', body: '{}' });
  await refreshBuilderGraph();
});

document.getElementById('builder-generate').addEventListener('click', async () => {
  if (!builderSessionId) return;
  const { source } = await api(`/api/builder/sessions/${builderSessionId}/generate`);
  document.getElementById('builder-source').textContent = source;
});

async function loadPanel(name) {
  if (name === 'projects') {
    await loadProjects();
    return;
  }
  if (name === 'builder') {
    const { projects } = await api('/api/projects');
    if (projects?.[0]) {
      await ensureBuilderSession(projects[0].projectId);
      await refreshBuilderGraph();
    }
    return;
  }
  const map = {
    data: '/api/data',
    rtc: '/api/rtc',
    storage: '/api/storage',
    deploy: '/api/deploy',
    logs: '/api/logs',
    settings: '/api/settings',
  };
  const path = map[name];
  if (!path) return;
  const data = await api(path);
  const out = document.getElementById(`${name}-output`);
  if (out) out.textContent = JSON.stringify(data, null, 2);
}

loadTemplates();
loadProjects();
loadPanel('projects');
