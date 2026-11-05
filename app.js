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

// Base de datos de Memes Legendarios
const MEMES = {
  neutral: {
    id: "guide-neutral",
    title: "Harold Hide The Pain",
    phrase: '"Sonriendo por fuera... pero qué calor hace acá."',
    img: "https://i.imgflip.com/gk5el.jpg",
    soundFreq: 260
  },
  mouth: {
    id: "guide-mouth",
    title: "Pikachu en Shock Total",
    phrase: '"¡¡¡¿¿¿CÓMO QUE MAÑANA ES LUNES???!!!"',
    img: "https://i.imgflip.com/2kbn1e.jpg",
    soundFreq: 620
  },
  smile: {
    id: "guide-smile",
    title: "Leonardo DiCaprio Brindando",
    phrase: '"¡Salud por esa sonrisa millonaria, campeón!"',
    img: "https://i.imgflip.com/39t1o.jpg",
    soundFreq: 520
  },
  wink: {
    id: "guide-wink",
    title: "The Rock Sospechoso",
    phrase: '"🤨 Te vi guiñando... ¿Qué estás tramando?"',
    img: "https://i.imgflip.com/5c7lwq.jpg",
    soundFreq: 180
  }
};

let faceLandmarker;
let lastVideoTime = -1;
let currentMemeKey = "neutral";
let soundEnabled = true;

// ----------------------------------------------------
// Generador de Efectos de Sonido Cómicos Retro (Web Audio API)
// Sin necesidad de archivos mp3 externos
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
    console.warn("Audio no inicializado:", e);
  }
}

// Control del botón de sonido
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
// 3. Bucle Continuo de Renderizado y Expresiones Faciales
// ----------------------------------------------------
function renderLoop() {
  if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const result = faceLandmarker.detectForVideo(video, performance.now());

    // Limpiar canvas
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    if (result.faceLandmarks && result.faceLandmarks.length > 0) {
      const landmarks = result.faceLandmarks[0];

      // Dibujar la malla facial dorada
      const drawingUtils = new DrawingUtils(canvasCtx);
      drawingUtils.drawConnectors(
        landmarks,
        FaceLandmarker.FACE_LANDMARKS_TESSELATION,
        { color: "#fbbf2470", lineWidth: 1 } // Malla en oro brillante translúcido
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

        // Clasificar la emoción dominante
        let detectedMeme = "neutral";
        let intensity = 0;

        if (jawOpen > 0.35) {
          detectedMeme = "mouth";
          intensity = Math.min(100, Math.round((jawOpen / 0.8) * 100));
        } else if (smileScore > 0.42) {
          detectedMeme = "smile";
          intensity = Math.min(100, Math.round((smileScore / 0.8) * 100));
        } else if (isWinking) {
          detectedMeme = "wink";
          intensity = 85;
        } else {
          detectedMeme = "neutral";
          intensity = 25;
        }

        // Actualizar el medidor Meme-O-Meter
        meterFill.style.width = intensity + "%";
        meterVal.textContent = intensity + "%";

        // Cambiar meme si la expresión es distinta a la anterior
        if (detectedMeme !== currentMemeKey) {
          setMeme(detectedMeme);
        }
      }
    }
  }

  requestAnimationFrame(renderLoop);
}

// ----------------------------------------------------
// Actualizar la Interfaz con el Meme Activo
// ----------------------------------------------------
function setMeme(memeKey) {
  currentMemeKey = memeKey;
  const memeData = MEMES[memeKey];
  if (!memeData) return;

  // Actualizar imagen con efecto de brinco cómico
  memeImg.src = memeData.img;
  memeImg.classList.remove("meme-bounce");
  void memeImg.offsetWidth; // Forzar reflow para reiniciar animación
  memeImg.classList.add("meme-bounce");

  // Actualizar títulos y frases
  memeTitle.textContent = memeData.title;
  memePhrase.textContent = memeData.phrase;

  // Actualizar guía de tarjetas abajo
  document.querySelectorAll(".guide-card").forEach(c => c.classList.remove("active-card"));
  const activeGuideCard = document.getElementById(memeData.id);
  if (activeGuideCard) {
    activeGuideCard.classList.add("active-card");
  }

  // Sonido cómico retro
  playComicTone(memeData.soundFreq);
}

// Iniciar aplicación
initMediaPipe();
