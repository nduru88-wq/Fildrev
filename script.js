// 1) Indsæt din Publishable key nedenfor.
const SUPABASE_URL = "https://yjcyfczhjjminzmotvcj.supabase.co";
const SUPABASE_KEY = "sb_publishable_23FFRX9kGlcBUxAjJCtphA_J0bMVYOA";

// VIGTIGT: bucket-navnet er case-sensitive og er oprettet som "Fildrev".
const BUCKET = "Fildrev";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentPath = "";

const itemsEl = document.getElementById("items");
const statusEl = document.getElementById("status");
const breadcrumbsEl = document.getElementById("breadcrumbs");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const uploadBox = document.getElementById("uploadBox");
const uploadText = document.getElementById("uploadText");
const uploadProgress = document.getElementById("uploadProgress");

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = () => uploadFiles([...fileInput.files]);

function cleanName(name) {
  return name.replace(/[\\/]/g, "_");
}

function pathFor(name) {
  return currentPath ? `${currentPath}/${name}` : name;
}

function iconFor(name) {
  if (/\.(png|jpe?g|gif|webp|heic)$/i.test(name)) return "🖼️";
  if (/\.pdf$/i.test(name)) return "📕";
  if (/\.(mp4|mov|m4v)$/i.test(name)) return "🎬";
  return "📄";
}

function renderBreadcrumbs() {
  breadcrumbsEl.innerHTML = "";
  const root = document.createElement("button");
  root.textContent = "Fildrev";
  root.onclick = () => { currentPath = ""; loadFolder(); };
  breadcrumbsEl.append(root);

  let accumulated = "";
  currentPath.split("/").filter(Boolean).forEach(part => {
    breadcrumbsEl.append(" / ");
    accumulated = accumulated ? `${accumulated}/${part}` : part;
    const p = accumulated;
    const b = document.createElement("button");
    b.textContent = part;
    b.onclick = () => { currentPath = p; loadFolder(); };
    breadcrumbsEl.append(b);
  });
}

async function loadFolder() {
  renderBreadcrumbs();
  itemsEl.innerHTML = "";
  statusEl.textContent = "Indlæser…";

  const { data, error } = await client.storage.from(BUCKET).list(currentPath, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" }
  });

  if (error) {
    statusEl.textContent = "Kunne ikke hente indhold: " + error.message;
    return;
  }

  const rows = data || [];
  statusEl.textContent = rows.length ? `${rows.length} element${rows.length === 1 ? "" : "er"}` : "Mappen er tom";

  rows.forEach(item => {
    // Supabase mapper/prefixes har typisk ingen id.
    const isFolder = !item.id;
    const card = document.createElement("div");
    card.className = "card";

    const icon = document.createElement("div");
    icon.className = "icon";
    icon.textContent = isFolder ? "📁" : iconFor(item.name);

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name;

    card.append(icon, name);

    if (isFolder) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = "Mappe";
      card.append(meta);
      card.onclick = () => {
        currentPath = pathFor(item.name);
        loadFolder();
      };
    } else {
      const actions = document.createElement("div");
      actions.className = "file-actions";

      const open = document.createElement("button");
      open.textContent = "Åbn";
      open.onclick = e => { e.stopPropagation(); openFile(pathFor(item.name)); };

      const download = document.createElement("button");
      download.textContent = "Hent";
      download.onclick = e => { e.stopPropagation(); downloadFile(pathFor(item.name), item.name); };

      actions.append(open, download);
      card.append(actions);
    }

    itemsEl.append(card);
  });
}

async function signedUrl(filePath, downloadName = null) {
  const options = downloadName ? { download: downloadName } : {};
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(filePath, 60, options);
  if (error) throw error;
  return data.signedUrl;
}

async function openFile(filePath) {
  try {
    window.open(await signedUrl(filePath), "_blank", "noopener");
  } catch (e) {
    alert("Kunne ikke åbne filen: " + e.message);
  }
}

async function downloadFile(filePath, fileName) {
  try {
    window.location.href = await signedUrl(filePath, fileName);
  } catch (e) {
    alert("Kunne ikke hente filen: " + e.message);
  }
}

async function uploadFiles(files) {
  if (!files.length) return;
  uploadBox.classList.remove("hidden");
  uploadProgress.max = files.length;
  uploadProgress.value = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    uploadText.textContent = `Uploader ${i + 1}/${files.length}: ${file.name}`;

    // Unikt prefix forhindrer overskrivning/navnekollisioner.
    const unique = `${Date.now()}-${crypto.randomUUID().slice(0,8)}-${cleanName(file.name)}`;
    const filePath = pathFor(unique);

    const { error } = await client.storage.from(BUCKET).upload(filePath, file, {
      upsert: false,
      contentType: file.type || undefined
    });

    if (error) {
      alert(`Kunne ikke uploade ${file.name}: ${error.message}`);
      break;
    }
    uploadProgress.value = i + 1;
  }

  fileInput.value = "";
  uploadText.textContent = "Upload færdig";
  await loadFolder();
  setTimeout(() => uploadBox.classList.add("hidden"), 1500);
}

loadFolder();
