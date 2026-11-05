import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Cliente oficial de Supabase mediante ESM
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ====================================================
// ELEMENTOS DEL DOM
// ====================================================
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const memeImg = document.getElementById("meme");
const memeTitle = document.getElementById("meme-title");
const memePhrase = document.getElementById("meme-phrase");
const meterFill = document.getElementById("meter-fill");
const meterVal = document.getElementById("meter-val");
const statusLabel = document.getElementById("status-label");
const statusDot = document.getElementById("status-dot");
const btnSound = document.getElementById("btn-sound");
const soundStatus = document.getElementById("sound-status");
const catalogGrid = document.getElementById("catalog-grid");
const catalogCount = document.getElementById("catalog-count");

// Control de Cámara
const btnCameraToggle = document.getElementById("btn-camera-toggle");
const cameraOffOverlay = document.getElementById("camera-off-overlay");
const btnTurnOnOverlay = document.getElementById("btn-turn-on-overlay");

// Modal de Subida de Memes
const btnOpenUpload = document.getElementById("btn-open-upload");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const modalUpload = document.getElementById("modal-upload");
const formUploadMeme = document.getElementById("form-upload-meme");
const inputMemeFile = document.getElementById("input-meme-file");
const previewUpload = document.getElementById("preview-upload");
const btnResetCatalog = document.getElementById("btn-reset-catalog");

// Modal de Configuración Supabase
const btnSupabaseModal = document.getElementById("btn-supabase-modal");
const supabaseStatusText = document.getElementById("supabase-status-text");
const modalSupabase = document.getElementById("modal-supabase");
const btnCloseSupabase = document.getElementById("btn-close-supabase");
const formSupabaseConfig = document.getElementById("form-supabase-config");
const inputSupabaseUrl = document.getElementById("input-supabase-url");
const inputSupabaseKey = document.getElementById("input-supabase-key");
const btnDisconnectSupabase = document.getElementById("btn-disconnect-supabase");

// ====================================================
// MEMES PREDETERMINADOS (TUS 5 FOTOS)
// ====================================================
const DEFAULT_MEMES = [
  {
    id: "def_1",
    title: "¡¡¡SHOCK TOTAL!!!",
    phrase: '"¡¡¡¿¿¿CÓMO QUE EL EXAMEN ERA PARA HOY???!!!',
    emotion: "boca",
    img: "img/grito_shock.jpg",
    isCustom: false,
    soundFreq: 620
  },
  {
    id: "def_2",
    title: "Perrito con Paleta",
    phrase: '"¡¡¡LENGUA AFUERA Y PALETA EN MANO, SOY FELIZ!!!',
    emotion: "lengua",
    img: "img/perrito_paleta_blanco.jpg",
    isCustom: false,
    soundFreq: 520
  },
  {
    id: "def_3",
    title: "Alegría Pug",
    phrase: '"¡Sonreír no cuesta nada y la vida es hermosa!"',
    emotion: "sonrisa",
    img: "img/perrito_paleta_negro.jpg",
    isCustom: false,
    soundFreq: 560
  },
  {
    id: "def_4",
    title: "Mirada de Juicio",
    phrase: '"Te estoy juzgando en silencio... sé exactamente lo que hiciste."',
    emotion: "serio",
    img: "img/perro_serio_juzgando.jpg",
    isCustom: false,
    soundFreq: 240
  },
  {
    id: "def_5",
    title: "Shaq: Tiempo Fuera",
    phrase: '"Momento... pará un poco la mano un segundo."',
    emotion: "guino",
    img: "img/shaq_timeout.jpg",
    isCustom: false,
    soundFreq: 190
  }
];

// Estado de la Aplicación
let memesCatalog = loadLocalCatalog();
let currentEmotion = "serio";
let soundEnabled = true;
let faceLandmarker = null;
let lastVideoTime = -1;
let lastMemeId = null;
let animationFrameId = null;
let mediaStream = null;
let isCameraActive = true;

// Cliente de Supabase
let supabase = null;
let isSupabaseConnected = false;

const EMOTION_MAP = {
  boca: { label: "Boca Abierta", emoji: "😮", guideId: "guide-boca" },
  sonrisa: { label: "Sonrisa", emoji: "😄", guideId: "guide-sonrisa" },
  serio: { label: "Cara Seria", emoji: "😐", guideId: "guide-serio" },
  guino: { label: "Guiño", emoji: "😉", guideId: "guide-guino" },
  lengua: { label: "Sacar Lengua", emoji: "😛", guideId: "guide-lengua" }
};

// ====================================================
// CONEXIÓN A SUPABASE (POSTGRESQL & REALTIME)
// ====================================================
async function setupSupabaseConnection() {
  const savedUrl = localStorage.getItem("https://ykgbowimuljvnakvwwga.supabase.co") || "";
  const savedKey = localStorage.getItem("sb_publishable_VXQHbKZQ1853CTCaQpBjdw_wDa4Lae7") || "";

  inputSupabaseUrl.value = savedUrl;
  inputSupabaseKey.value = savedKey;

  if (!savedUrl || !savedKey) {
    setSupabaseOfflineUI("Modo Local");
    return;
  }

  try {
    supabase = createClient(savedUrl, savedKey);

    // Probar conexión con una consulta simple
    const { data, error } = await supabase.from("memes").select("id, titulo, frase, emocion, imagen_url").limit(50);

    if (error) {
      console.warn("Fallo al conectar con Supabase:", error);
      setSupabaseOfflineUI("Error Conexión");
      return;
    }

    isSupabaseConnected = true;
    setSupabaseOnlineUI();

    // Si hay datos en Supabase, sincronizar el catálogo
    if (data && data.length > 0) {
      memesCatalog = data.map(item => ({
        id: item.id,
        title: item.titulo,
        phrase: item.frase,
        emotion: item.emocion,
        img: item.imagen_url,
        isCustom: true,
        soundFreq: 450
      }));
      renderCatalog();
    }

    // Escuchar cambios en Tiempo Real (Realtime) para que se actualice solo
    supabase.channel("public:memes")
      .on("postgres_changes", { event: "*", schema: "public", table: "memes" }, async () => {
        console.log("⚡ Cambio detectado en Supabase en tiempo real. Actualizando catálogo...");
        await fetchMemesFromSupabase();
      })
      .subscribe();

  } catch (err) {
    console.warn("Error al inicializar Supabase:", err);
    setSupabaseOfflineUI("Modo Local");
  }
}

async function fetchMemesFromSupabase() {
  if (!supabase || !isSupabaseConnected) return;
  try {
    const { data } = await supabase.from("memes").select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      memesCatalog = data.map(item => ({
        id: item.id,
        title: item.titulo,
        phrase: item.frase,
        emotion: item.emocion,
        img: item.imagen_url,
        isCustom: true,
        soundFreq: 450
      }));
      renderCatalog();
    }
  } catch (e) {
    console.warn("Error al recargar desde Supabase:", e);
  }
}

function setSupabaseOnlineUI() {
  btnSupabaseModal.classList.remove("offline");
  supabaseStatusText.textContent = "🟢 En Vivo";
}

function setSupabaseOfflineUI(text) {
  isSupabaseConnected = false;
  btnSupabaseModal.classList.add("offline");
  supabaseStatusText.textContent = text || "Modo Local";
}

// Modal Supabase
btnSupabaseModal.addEventListener("click", () => {
  modalSupabase.classList.add("active");
});
btnCloseSupabase.addEventListener("click", () => {
  modalSupabase.classList.remove("active");
});
modalSupabase.addEventListener("click", (e) => {
  if (e.target === modalSupabase) modalSupabase.classList.remove("active");
});

formSupabaseConfig.addEventListener("submit", async (e) => {
  e.preventDefault();
  const url = inputSupabaseUrl.value.trim();
  const key = inputSupabaseKey.value.trim();

  localStorage.setItem("supabase_url", url);
  localStorage.setItem("supabase_key", key);

  modalSupabase.classList.remove("active");
  alert("Guardando credenciales... Conectando a Supabase.");
  await setupSupabaseConnection();
});

btnDisconnectSupabase.addEventListener("click", () => {
  if (confirm("¿Desconectar Supabase y volver al almacenamiento local?")) {
    localStorage.removeItem("supabase_url");
    localStorage.removeItem("supabase_key");
    supabase = null;
    isSupabaseConnected = false;
    inputSupabaseUrl.value = "";
    inputSupabaseKey.value = "";
    setSupabaseOfflineUI("Modo Local");
    memesCatalog = loadLocalCatalog();
    renderCatalog();
    modalSupabase.classList.remove("active");
  }
});

// ====================================================
// GESTIÓN DEL CATÁLOGO Y LOCALSTORAGE
// ====================================================
function loadLocalCatalog() {
  try {
    const saved = localStorage.getItem("meme_o_matic_catalog");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {}
  return [...DEFAULT_MEMES];
}

function saveCatalog() {
  try {
    localStorage.setItem("meme_o_matic_catalog", JSON.stringify(memesCatalog));
  } catch (e) {}
  renderCatalog();
}

function renderCatalog() {
  catalogGrid.innerHTML = "";
  catalogCount.textContent = memesCatalog.length;

  memesCatalog.forEach((meme) => {
    const card = document.createElement("div");
    card.className = "catalog-card";
    card.title = "Haz clic para probar este meme en vivo";

    const emotionInfo = EMOTION_MAP[meme.emotion] || { label: meme.emotion, emoji: "⭐" };

    card.innerHTML = `
      ${meme.isCustom ? `<button class="catalog-delete-btn" title="Eliminar meme">&times;</button>` : ""}
      <div class="catalog-thumb-box">
        <img class="catalog-thumb" src="${meme.img}" alt="${meme.title}" onerror="this.src='img/perro_serio_juzgando.jpg'">
      </div>
      <div class="catalog-emotion-tag">${emotionInfo.emoji} ${emotionInfo.label}</div>
      <h4 class="catalog-title">${meme.title}</h4>
      <p class="catalog-phrase">${meme.phrase}</p>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("catalog-delete-btn")) return;
      displayMeme(meme);
    });

    if (meme.isCustom) {
      const delBtn = card.querySelector(".catalog-delete-btn");
      delBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar el meme "${meme.title}"?`)) {
          // Si está conectado a Supabase, borrar también de la base de datos
          if (isSupabaseConnected && supabase && typeof meme.id === "number") {
            try {
              await supabase.from("memes").delete().eq("id", meme.id);
            } catch (err) {
              console.warn("Error al borrar en Supabase:", err);
            }
          }
          memesCatalog = memesCatalog.filter(m => m.id !== meme.id);
          saveCatalog();
        }
      });
    }

    catalogGrid.appendChild(card);
  });
}

// ====================================================
// SUBIDA DE NUEVO MEME
// ====================================================
let uploadedImageBase64 = null;

btnOpenUpload.addEventListener("click", () => {
  modalUpload.classList.add("active");
  formUploadMeme.reset();
  uploadedImageBase64 = null;
  previewUpload.style.display = "none";
});

function closeUploadModal() {
  modalUpload.classList.remove("active");
}
btnCloseModal.addEventListener("click", closeUploadModal);
btnCancelModal.addEventListener("click", closeUploadModal);
modalUpload.addEventListener("click", (e) => {
  if (e.target === modalUpload) closeUploadModal();
});

inputMemeFile.addEventListener("change", (e) => {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (event) {
    uploadedImageBase64 = event.target.result;
    previewUpload.src = uploadedImageBase64;
    previewUpload.style.display = "block";
  };
  reader.readAsDataURL(file);
});

formUploadMeme.addEventListener("submit", async (e) => {
  e.preventDefault();

  const title = document.getElementById("input-meme-title").value.trim();
  const phrase = document.getElementById("input-meme-phrase").value.trim();
  const emotion = document.getElementById("select-meme-emotion").value;

  if (!uploadedImageBase64) {
    alert("Por favor selecciona una imagen para tu meme.");
    return;
  }

  const formattedPhrase = phrase ? (phrase.startsWith('"') ? phrase : `"${phrase}"`) : '"¡Meme sin palabras!"';

  // Si Supabase está conectado, insertar en la base de datos remota
  if (isSupabaseConnected && supabase) {
    try {
      const { data, error } = await supabase.from("memes").insert([
        {
          titulo: title || "Meme Comunitario",
          frase: formattedPhrase,
          emocion: emotion,
          imagen_url: uploadedImageBase64,
          autor: "Comunidad"
        }
      ]).select();

      if (!error && data && data.length > 0) {
        console.log("Meme subido exitosamente a Supabase.");
      }
    } catch (err) {
      console.warn("Aviso al subir a Supabase:", err);
    }
  }

  const newMeme = {
    id: "user_" + Date.now(),
    title: title || "Meme Comunitario",
    phrase: formattedPhrase,
    emotion: emotion,
    img: uploadedImageBase64,
    isCustom: true,
    soundFreq: 480
  };

  memesCatalog.unshift(newMeme);
  saveCatalog();
  closeUploadModal();
  displayMeme(newMeme);

  alert(`¡Tu meme "${newMeme.title}" se publicó con éxito! Haz el gesto ${EMOTION_MAP[emotion].emoji} para activarlo.`);
});

// Resetear catálogo
btnResetCatalog.addEventListener("click", () => {
  if (confirm("¿Restablecer el catálogo a los 5 memes originales?")) {
    memesCatalog = [...DEFAULT_MEMES];
    saveCatalog();
    displayMeme(DEFAULT_MEMES[3]);
  }
});

// ====================================================
// CONTROL DE ENCENDER Y APAGAR CÁMARA
// ====================================================
async function toggleCamera() {
  if (isCameraActive) {
    turnOffCamera();
  } else {
    await turnOnCamera();
  }
}

function turnOffCamera() {
  isCameraActive = false;

  // Detener las pistas de video para apagar la luz de la cámara
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Limpiar canvas y mostrar pantalla de reposo
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  cameraOffOverlay.style.display = "flex";

  // Actualizar botones y badges
  btnCameraToggle.innerHTML = "▶️ Encender Cámara";
  btnCameraToggle.className = "btn-camera-on";
  statusLabel.textContent = "CÁMARA APAGADA";
  statusDot.textContent = "⚪";

  meterFill.style.width = "0%";
  meterVal.textContent = "0%";
}

async function turnOnCamera() {
  statusLabel.textContent = "CONECTANDO CÁMARA...";
  statusDot.textContent = "🟡";

  try {
    await startCamera();
    isCameraActive = true;
    cameraOffOverlay.style.display = "none";

    btnCameraToggle.innerHTML = "🛑 Apagar Cámara";
    btnCameraToggle.className = "btn-camera-off";
    statusLabel.textContent = "JUGADOR 1 CONECTADO";
    statusDot.textContent = "🟢";
  } catch (err) {
    console.error("Error al reactivar cámara:", err);
    turnOffCamera();
  }
}

btnCameraToggle.addEventListener("click", toggleCamera);
btnTurnOnOverlay.addEventListener("click", turnOnCamera);

// ====================================================
// EFECTOS DE SONIDO CÓMICOS
// ====================================================
let audioCtx = null;
function playComicTone(freq, type = "triangle", duration = 0.15) {
  if (!soundEnabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {}
}

btnSound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundStatus.textContent = soundEnabled ? "ON" : "OFF";
  btnSound.style.opacity = soundEnabled ? "1" : "0.6";
});

// ====================================================
// MEDIAPIPE FACE LANDMARKER
// ====================================================
async function initMediaPipe() {
  statusLabel.textContent = "DESCARGANDO MODELO IA...";

  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
    );

    faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
    });

    statusLabel.textContent = "INICIANDO CÁMARA...";
    await startCamera();
  } catch (error) {
    console.error("Error al inicializar MediaPipe:", error);
    statusLabel.textContent = "ERROR AL CARGAR IA";
  }
}

async function startCamera() {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480 }
  });
  video.srcObject = mediaStream;
  await video.play();

  statusLabel.textContent = "JUGADOR 1 CONECTADO";
  statusDot.textContent = "🟢";

  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  renderLoop();
}

function renderLoop() {
  if (!isCameraActive) return;

  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const result = faceLandmarker.detectForVideo(video, performance.now());

    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];

      // Malla facial dorada
      const drawingUtils = new DrawingUtils(canvasCtx);
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#fbbf2470", lineWidth: 1 }
      );

      // Evaluación de gestos faciales
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        const shapes = result.faceBlendshapes[0].categories;

        const jawOpen = shapes.find(s => s.categoryName === "jawOpen")?.score || 0;
        const smileLeft = shapes.find(s => s.categoryName === "mouthSmileLeft")?.score || 0;
        const smileRight = shapes.find(s => s.categoryName === "mouthSmileRight")?.score || 0;
        const smileScore = Math.max(smileLeft, smileRight);

        const blinkLeft = shapes.find(s => s.categoryName === "eyeBlinkLeft")?.score || 0;
        const blinkRight = shapes.find(s => s.categoryName === "eyeBlinkRight")?.score || 0;
        const isWinking = (blinkLeft > 0.55 && blinkRight < 0.25) || (blinkRight > 0.55 && blinkLeft < 0.25);
        
        // Detección aproximada de sacar la lengua (mediante estiramiento labial vertical o blendshape si está disponible)
        const tongueOut = shapes.find(s => s.categoryName === "tongueOut")?.score || 0;

        let detectedEmotion = "serio";
        let intensity = 20;

        if (tongueOut > 0.3 || (jawOpen > 0.25 && smileScore < 0.2 && shapes.find(s => s.categoryName === "mouthPucker")?.score > 0.3)) {
          detectedEmotion = "lengua";
          intensity = Math.min(100, Math.round(((tongueOut > 0 ? tongueOut : jawOpen) / 0.6) * 100));
        } else if (jawOpen > 0.38) {
          detectedEmotion = "boca";
          intensity = Math.min(100, Math.round((jawOpen / 0.75) * 100));
        } else if (smileScore > 0.42) {
          detectedEmotion = "sonrisa";
          intensity = Math.min(100, Math.round((smileScore / 0.75) * 100));
        } else if (isWinking) {
          detectedEmotion = "guino";
          intensity = 85;
        } else {
          detectedEmotion = "serio";
          intensity = 25;
        }

        meterFill.style.width = intensity + "%";
        meterVal.textContent = intensity + "%";

        if (detectedEmotion !== currentEmotion) {
          currentEmotion = detectedEmotion;
          triggerMemeForEmotion(detectedEmotion);
        }
      }
    }
  }

  animationFrameId = requestAnimationFrame(renderLoop);
}

function triggerMemeForEmotion(emotionKey) {
  const matchingMemes = memesCatalog.filter(m => m.emotion === emotionKey);
  if (matchingMemes.length === 0) return;

  let chosenMeme = matchingMemes[0];
  if (matchingMemes.length > 1) {
    const others = matchingMemes.filter(m => m.id !== lastMemeId);
    chosenMeme = others[Math.floor(Math.random() * others.length)] || matchingMemes[0];
  }

  displayMeme(chosenMeme);
}

function displayMeme(meme) {
  lastMemeId = meme.id;

  memeImg.src = meme.img;
  memeImg.classList.remove("meme-bounce");
  void memeImg.offsetWidth;
  memeImg.classList.add("meme-bounce");

  memeTitle.textContent = meme.title;
  memePhrase.textContent = meme.phrase;

  document.querySelectorAll(".guide-card").forEach(c => c.classList.remove("active-card"));
  const emotionInfo = EMOTION_MAP[meme.emotion];
  if (emotionInfo) {
    const guideCard = document.getElementById(emotionInfo.guideId);
    if (guideCard) {
      guideCard.classList.add("active-card");
    }
  }

  playComicTone(meme.soundFreq || 350);
}

// ====================================================
// INICIO AUTOMÁTICO
// ====================================================
renderCatalog();
setupSupabaseConnection();
initMediaPipe();