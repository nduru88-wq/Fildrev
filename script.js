const SUPABASE_URL = 'https://yjcyfczhjjminzmotvcj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_23FFRX9kGlcBUxAjJCtphA_J0bMVYOA';
const BUCKET = 'Fildrev';

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentPath = "";
let currentRows = [];
const selected = new Map();

const itemsEl = document.getElementById("items");
const statusEl = document.getElementById("status");
const selectionStatusEl = document.getElementById("selectionStatus");
const breadcrumbsEl = document.getElementById("breadcrumbs");
const fileInput = document.getElementById("fileInput");
const uploadBtn = document.getElementById("uploadBtn");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const dropZone = document.getElementById("dropZone");
const uploadBox = document.getElementById("uploadBox");
const uploadText = document.getElementById("uploadText");
const uploadProgress = document.getElementById("uploadProgress");
const downloadBox = document.getElementById("downloadBox");
const downloadText = document.getElementById("downloadText");
const downloadProgress = document.getElementById("downloadProgress");

uploadBtn.onclick = () => fileInput.click();
fileInput.onchange = () => uploadFiles([...fileInput.files]);
downloadSelectedBtn.onclick = () => downloadSelected();

["dragenter","dragover"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.add("dragover");
}));
["dragleave","drop"].forEach(ev => dropZone.addEventListener(ev, e => {
  e.preventDefault(); dropZone.classList.remove("dragover");
}));
dropZone.addEventListener("drop", e => uploadFiles([...e.dataTransfer.files]));

function cleanName(name) { return name.replace(/[\\/]/g, "_"); }
function pathFor(name) { return currentPath ? `${currentPath}/${name}` : name; }
function displayName(name) { return name.replace(/^\d{13}-[0-9a-f]{8}-/, ""); }
function isImage(name) { return /\.(png|jpe?g|gif|webp)$/i.test(name); }
function iconFor(name) {
  if (/\.pdf$/i.test(name)) return "📕";
  if (/\.(mp4|mov|m4v)$/i.test(name)) return "🎬";
  if (/\.(zip|rar|7z)$/i.test(name)) return "🗜️";
  if (/\.(docx?|odt)$/i.test(name)) return "📝";
  return "📄";
}
function humanSize(bytes) {
  if (bytes == null) return "";
  const u=["B","KB","MB","GB"]; let i=0,n=bytes;
  while(n>=1024 && i<u.length-1){n/=1024;i++;}
  return `${n.toFixed(i?1:0)} ${u[i]}`;
}

function renderBreadcrumbs() {
  breadcrumbsEl.innerHTML="";
  const root=document.createElement("button"); root.textContent="Fildrev";
  root.onclick=()=>{currentPath="";selected.clear();loadFolder();}; breadcrumbsEl.append(root);
  let acc="";
  currentPath.split("/").filter(Boolean).forEach(part=>{
    breadcrumbsEl.append(" › "); acc=acc?`${acc}/${part}`:part; const p=acc;
    const b=document.createElement("button"); b.textContent=part;
    b.onclick=()=>{currentPath=p;selected.clear();loadFolder();}; breadcrumbsEl.append(b);
  });
}

function updateSelectionUI() {
  selectionStatusEl.textContent = selected.size ? `${selected.size} valgt` : "";
  downloadSelectedBtn.classList.toggle("hidden", selected.size===0);
}

async function loadFolder() {
  renderBreadcrumbs(); itemsEl.innerHTML=""; statusEl.textContent="Indlæser…"; selected.clear(); updateSelectionUI();
  const {data,error}=await client.storage.from(BUCKET).list(currentPath,{limit:1000,sortBy:{column:"name",order:"asc"}});
  if(error){statusEl.textContent="Kunne ikke hente indhold: "+error.message;return;}
  currentRows=data||[];
  statusEl.textContent=currentRows.length?`${currentRows.length} element${currentRows.length===1?"":"er"}`:"Mappen er tom";
  currentRows.forEach(renderCard);
}

function renderCard(item) {
  const isFolder=!item.id, fullPath=pathFor(item.name);
  const card=document.createElement("article"); card.className="card"+(isFolder?" folder":"");
  const check=document.createElement("input"); check.type="checkbox"; check.className="check";
  check.onchange=()=>{
    if(check.checked){selected.set(fullPath,{path:fullPath,name:item.name,isFolder});card.classList.add("selected");}
    else{selected.delete(fullPath);card.classList.remove("selected");}
    updateSelectionUI();
  };
  const preview=document.createElement("div"); preview.className="preview";
  if(isFolder) {
    preview.innerHTML='<div class="big-icon">📁</div>';
    preview.onclick=()=>{currentPath=fullPath;selected.clear();loadFolder();};
  } else if(isImage(item.name)) {
    const img=document.createElement("img"); img.alt=displayName(item.name); img.loading="lazy";
    preview.append(img); loadThumb(fullPath,img); preview.onclick=()=>openFile(fullPath);
  } else {
    preview.innerHTML=`<div class="big-icon">${iconFor(item.name)}</div>`;
    preview.onclick=()=>openFile(fullPath);
  }
  const body=document.createElement("div"); body.className="card-body";
  const name=document.createElement("div"); name.className="name"; name.title=displayName(item.name); name.textContent=displayName(item.name);
  if(isFolder) name.onclick=()=>{currentPath=fullPath;selected.clear();loadFolder();};
  const meta=document.createElement("div"); meta.className="meta";
  meta.textContent=isFolder?"Mappe":humanSize(item.metadata?.size);
  body.append(name,meta);
  if(isFolder) {
    const dl=document.createElement("button"); dl.className="folder-download"; dl.textContent="⬇ Download mappe";
    dl.onclick=()=>downloadAsZip([{path:fullPath,name:item.name,isFolder:true}], item.name+".zip");
    body.append(dl);
  } else {
    const actions=document.createElement("div"); actions.className="file-actions";
    const open=document.createElement("button"); open.textContent="Åbn"; open.onclick=()=>openFile(fullPath);
    const dl=document.createElement("button"); dl.textContent="Hent"; dl.onclick=()=>downloadFile(fullPath,displayName(item.name));
    actions.append(open,dl); body.append(actions);
  }
  card.append(check,preview,body); itemsEl.append(card);
}

async function loadThumb(path,img) {
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,300);
  if(!error) img.src=data.signedUrl;
}
async function signedUrl(path,downloadName=null) {
  const options=downloadName?{download:downloadName}:{};
  const {data,error}=await client.storage.from(BUCKET).createSignedUrl(path,60,options);
  if(error) throw error; return data.signedUrl;
}
async function openFile(path) {
  try{window.open(await signedUrl(path),"_blank","noopener");}catch(e){alert("Kunne ikke åbne filen: "+e.message);}
}
async function downloadFile(path,name) {
  try{window.location.href=await signedUrl(path,name);}catch(e){alert("Kunne ikke hente filen: "+e.message);}
}

async function collectFolder(folderPath, zipBase, output) {
  const {data,error}=await client.storage.from(BUCKET).list(folderPath,{limit:1000,sortBy:{column:"name",order:"asc"}});
  if(error) throw error;
  for(const item of (data||[])) {
    const p=`${folderPath}/${item.name}`;
    if(!item.id) await collectFolder(p,`${zipBase}/${item.name}`,output);
    else output.push({path:p,zipPath:`${zipBase}/${displayName(item.name)}`});
  }
}

async function downloadSelected() {
  if(!selected.size) return;
  const arr=[...selected.values()];
  if(arr.length===1 && !arr[0].isFolder) return downloadFile(arr[0].path,displayName(arr[0].name));
  await downloadAsZip(arr, currentPath.split("/").pop() || "Fildrev");
}

async function downloadAsZip(entries, suggestedName) {
  downloadBox.classList.remove("hidden"); downloadText.textContent="Finder filer…"; downloadProgress.value=0;
  try {
    const files=[];
    for(const entry of entries) {
      if(entry.isFolder) await collectFolder(entry.path,entry.name,files);
      else files.push({path:entry.path,zipPath:displayName(entry.name)});
    }
    if(!files.length) throw new Error("Der er ingen filer i det valgte.");
    downloadProgress.max=files.length;
    const zip=new JSZip();
    for(let i=0;i<files.length;i++) {
      downloadText.textContent=`Henter ${i+1} af ${files.length}…`;
      const {data,error}=await client.storage.from(BUCKET).download(files[i].path);
      if(error) throw error;
      zip.file(files[i].zipPath,data); downloadProgress.value=i+1;
    }
    downloadText.textContent="Pakker ZIP-fil…";
    const blob=await zip.generateAsync({type:"blob"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    const clean=(suggestedName||"Fildrev").replace(/\.zip$/i,"");
    a.download=clean+".zip"; document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
    downloadText.textContent="Download klar";
  } catch(e) {
    alert("Kunne ikke lave download: "+e.message);
  } finally {
    setTimeout(()=>downloadBox.classList.add("hidden"),1600);
  }
}

async function uploadFiles(files) {
  if(!files.length)return;
  uploadBox.classList.remove("hidden"); uploadProgress.max=files.length; uploadProgress.value=0;
  for(let i=0;i<files.length;i++) {
    const file=files[i]; uploadText.textContent=`Uploader ${i+1}/${files.length}: ${file.name}`;
    const unique=`${Date.now()}-${crypto.randomUUID().slice(0,8)}-${cleanName(file.name)}`;
    const {error}=await client.storage.from(BUCKET).upload(pathFor(unique),file,{upsert:false,contentType:file.type||undefined});
    if(error){alert(`Kunne ikke uploade ${file.name}: ${error.message}`);break;}
    uploadProgress.value=i+1;
  }
  fileInput.value=""; uploadText.textContent="Upload færdig"; await loadFolder();
  setTimeout(()=>uploadBox.classList.add("hidden"),1400);
}

loadFolder();
