import {
  FaceLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest";

// Elementos del DOM
const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const memeImg = document.getElementById("meme");
const memeTitle = document.getElementById("meme-title");
const memePhrase = document.getElementById("meme-phrase");
const meterFill = document.getElementById("meter-fill");
const meterVal = document.getElementById("meter-val");
const statusLabel = document.getElementById("status-label");
const btnSound = document.getElementById("btn-sound");
const soundStatus = document.getElementById("sound-status");
const catalogGrid = document.getElementById("catalog-grid");
const catalogCount = document.getElementById("catalog-count");

// Elementos del Modal de Subida
const btnOpenUpload = document.getElementById("btn-open-upload");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const modalUpload = document.getElementById("modal-upload");
const formUploadMeme = document.getElementById("form-upload-meme");
const inputMemeFile = document.getElementById("input-meme-file");
const previewUpload = document.getElementById("preview-upload");
const btnResetCatalog = document.getElementById("btn-reset-catalog");

// ----------------------------------------------------
// Colección Inicial con tus 5 Imágenes Subidas
// ----------------------------------------------------
const DEFAULT_MEMES = [
  {
    id: "def_1",
    title: "¡¡¡SHOCK TOTAL!!!",
    phrase: '"¡¡¡¿¿¿CÓMO QUE EL EXAMEN ERA PARA HOY???!!!"',
    emotion: "boca",
    img: "img/grito_shock.jpg",
    isCustom: false,
    soundFreq: 620
  },
  {
    id: "def_2",
    title: "Felicidad Pura",
    phrase: '"¡Soy el ser más dulce y feliz del planeta con mi chupetín!"',
    emotion: "sonrisa",
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

// Cargar catálogo desde localStorage o usar el predeterminado
let memesCatalog = loadCatalog();
let currentEmotion = "serio";
let soundEnabled = true;
let faceLandmarker = null;
let lastVideoTime = -1;
let lastMemeId = null;

// Diccionario de emojis y nombres por emoción
const EMOTION_MAP = {
  boca: { label: "Boca Abierta", emoji: "😮", guideId: "guide-boca" },
  sonrisa: { label: "Sonrisa", emoji: "😄", guideId: "guide-sonrisa" },
  serio: { label: "Cara Seria", emoji: "😐", guideId: "guide-serio" },
  guino: { label: "Guiño", emoji: "😉", guideId: "guide-guino" }
};

// ----------------------------------------------------
// Gestión de Catálogo y LocalStorage
// ----------------------------------------------------
function loadCatalog() {
  try {
    const saved = localStorage.getItem("meme_o_matic_catalog");
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("No se pudo cargar localStorage:", e);
  }
  return [...DEFAULT_MEMES];
}

function saveCatalog() {
  try {
    localStorage.setItem("meme_o_matic_catalog", JSON.stringify(memesCatalog));
  } catch (e) {
    console.warn("No se pudo guardar en localStorage:", e);
  }
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

    // Hacer clic para previsualizar inmediatamente en vivo
    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("catalog-delete-btn")) return;
      displayMeme(meme);
    });

    // Botón de eliminar para memes personalizados
    if (meme.isCustom) {
      const delBtn = card.querySelector(".catalog-delete-btn");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm(`¿Eliminar el meme "${meme.title}" del catálogo?`)) {
          memesCatalog = memesCatalog.filter(m => m.id !== meme.id);
          saveCatalog();
        }
      });
    }

    catalogGrid.appendChild(card);
  });
}

// ----------------------------------------------------
// Modal y Subida de Memes Propios
// ----------------------------------------------------
let uploadedImageBase64 = null;

btnOpenUpload.addEventListener("click", () => {
  modalUpload.classList.add("active");
  formUploadMeme.reset();
  uploadedImageBase64 = null;
  previewUpload.style.display = "none";
});

function closeModal() {
  modalUpload.classList.remove("active");
}
btnCloseModal.addEventListener("click", closeModal);
btnCancelModal.addEventListener("click", closeModal);
modalUpload.addEventListener("click", (e) => {
  if (e.target === modalUpload) closeModal();
});

// Previsualización de imagen al subirla
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

// Formulario de publicación de nuevo meme
formUploadMeme.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = document.getElementById("input-meme-title").value.trim();
  const phrase = document.getElementById("input-meme-phrase").value.trim();
  const emotion = document.getElementById("select-meme-emotion").value;

  if (!uploadedImageBase64) {
    alert("Por favor selecciona una imagen para tu meme.");
    return;
  }

  const newMeme = {
    id: "user_" + Date.now(),
    title: title || "Meme Comunitario",
    phrase: phrase ? `"${phrase}"` : '"¡Meme sin palabras!"',
    emotion: emotion,
    img: uploadedImageBase64,
    isCustom: true,
    soundFreq: 480
  };

  // Añadir al catálogo y persistir
  memesCatalog.unshift(newMeme);
  saveCatalog();
  closeModal();

  // Mostrar el nuevo meme inmediatamente con animación
  displayMeme(newMeme);
  alert(`¡Tu meme "${newMeme.title}" se agregó con éxito! Haz el gesto ${EMOTION_MAP[emotion].emoji} frente a la cámara para activarlo.`);
});

// Botón de reseteo a los 5 memes originales
btnResetCatalog.addEventListener("click", () => {
  if (confirm("¿Deseas restablecer el catálogo a los 5 memes originales?")) {
    memesCatalog = [...DEFAULT_MEMES];
    saveCatalog();
    displayMeme(DEFAULT_MEMES[3]); // Volver a mostrar el perro serio
  }
});

// ----------------------------------------------------
// Sonidos Cómicos Retro (Web Audio API)
// ----------------------------------------------------
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
  } catch (e) {
    console.warn("Audio Context:", e);
  }
}

btnSound.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundStatus.textContent = soundEnabled ? "ON" : "OFF";
  btnSound.style.opacity = soundEnabled ? "1" : "0.6";
});

// ----------------------------------------------------
// 1. Inicializar MediaPipe FaceLandmarker
// ----------------------------------------------------
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

// ----------------------------------------------------
// 2. Iniciar la Cámara Web
// ----------------------------------------------------
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 }
    });
    video.srcObject = stream;
    await video.play();

    statusLabel.textContent = "JUGADOR 1 CONECTADO";
    renderLoop();
  } catch (error) {
    console.error("Error al acceder a la cámara:", error);
    statusLabel.textContent = "ERROR: SIN CÁMARA";
    alert("No se pudo encender la cámara. Revisa los permisos del navegador.");
  }
}

// ----------------------------------------------------
// 3. Bucle de Renderizado y Detección Facial
// ----------------------------------------------------
function renderLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const result = faceLandmarker.detectForVideo(video, performance.now());

    // Limpiar canvas en cada fotograma
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];

      // Dibujar la malla facial dorada
      const drawingUtils = new DrawingUtils(canvasCtx);
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#fbbf2470", lineWidth: 1 } // Malla en oro translúcido
      );

      // Evaluar las expresiones faciales mediante faceBlendshapes
      if (result.faceBlendshapes && result.faceBlendshapes.length > 0) {
        const shapes = result.faceBlendshapes[0].categories;

        const jawOpen = shapes.find(s => s.categoryName === "jawOpen")?.score || 0;
        const smileLeft = shapes.find(s => s.categoryName === "mouthSmileLeft")?.score || 0;
        const smileRight = shapes.find(s => s.categoryName === "mouthSmileRight")?.score || 0;
        const smileScore = Math.max(smileLeft, smileRight);

        const blinkLeft = shapes.find(s => s.categoryName === "eyeBlinkLeft")?.score || 0;
        const blinkRight = shapes.find(s => s.categoryName === "eyeBlinkRight")?.score || 0;
        const isWinking = (blinkLeft > 0.55 && blinkRight < 0.25) || (blinkRight > 0.55 && blinkLeft < 0.25);

        // Clasificar emoción dominante
        let detectedEmotion = "serio";
        let intensity = 20;

        if (jawOpen > 0.35) {
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

        // Actualizar barra Meme-O-Meter
        meterFill.style.width = intensity + "%";
        meterVal.textContent = intensity + "%";

        // Si la emoción cambió, activar el meme correspondiente del catálogo
        if (detectedEmotion !== currentEmotion) {
          currentEmotion = detectedEmotion;
          triggerMemeForEmotion(detectedEmotion);
        }
      }
    }
  }

  requestAnimationFrame(renderLoop);
}

// ----------------------------------------------------
// Activar Meme Correspondiente a la Emoción
// ----------------------------------------------------
function triggerMemeForEmotion(emotionKey) {
  // Buscar memes que coincidan con esta emoción en el catálogo
  const matchingMemes = memesCatalog.filter(m => m.emotion === emotionKey);

  if (matchingMemes.length === 0) return;

  // Si hay más de uno (ej. los dos perritos sonrientes), elegir uno diferente al anterior
  let chosenMeme = matchingMemes[0];
  if (matchingMemes.length > 1) {
    const others = matchingMemes.filter(m => m.id !== lastMemeId);
    chosenMeme = others[Math.floor(Math.random() * others.length)] || matchingMemes[0];
  }

  displayMeme(chosenMeme);
}

function displayMeme(meme) {
  lastMemeId = meme.id;

  // Cambiar imagen con animación de brinco cómico
  memeImg.src = meme.img;
  memeImg.classList.remove("meme-bounce");
  void memeImg.offsetWidth; // Forzar reflow
  memeImg.classList.add("meme-bounce");

  // Actualizar textos
  memeTitle.textContent = meme.title;
  memePhrase.textContent = meme.phrase;

  // Resaltar la tarjeta correspondiente en la guía inferior
  document.querySelectorAll(".guide-card").forEach(c => c.classList.remove("active-card"));
  const emotionInfo = EMOTION_MAP[meme.emotion];
  if (emotionInfo) {
    const guideCard = document.getElementById(emotionInfo.guideId);
    if (guideCard) {
      guideCard.classList.add("active-card");
    }
  }

  // Sonido cómico retro
  playComicTone(meme.soundFreq || 350);
}

// ----------------------------------------------------
// Arranque de la Aplicación
// ----------------------------------------------------
renderCatalog();
initMediaPipe();
