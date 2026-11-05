-- ====================================================
-- Base de Datos: memes_db
-- Sistema: Meme-O-Matic 3000 (Gestor de Memes con IA)
-- Compatible con MySQL / MariaDB (XAMPP, WampServer, phpMyAdmin)
-- ====================================================

CREATE DATABASE IF NOT EXISTS memes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE memes_db;

-- 1. Tabla de Catálogo de Memes
CREATE TABLE IF NOT EXISTS memes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    titulo VARCHAR(120) NOT NULL,
    frase VARCHAR(255) NOT NULL,
    emocion ENUM('boca', 'sonrisa', 'serio', 'guino') NOT NULL,
    imagen_url MEDIUMTEXT NOT NULL,
    autor VARCHAR(100) DEFAULT 'Comunidad',
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Memes iniciales precargados (los 5 memes del usuario)
INSERT INTO memes (titulo, frase, emocion, imagen_url, autor) VALUES
('¡¡¡SHOCK TOTAL!!!', '¡¡¡¿¿¿CÓMO QUE EL EXAMEN ERA PARA HOY???!!!', 'boca', 'img/grito_shock.jpg', 'Comunidad'),
('Felicidad Pura', '¡Soy el ser más dulce y feliz del planeta con mi chupetín!', 'sonrisa', 'img/perrito_paleta_blanco.jpg', 'Comunidad'),
('Alegría Pug', '¡Sonreír no cuesta nada y la vida es hermosa!', 'sonrisa', 'img/perrito_paleta_negro.jpg', 'Comunidad'),
('Mirada de Juicio', 'Te estoy juzgando en silencio... sé exactamente lo que hiciste.', 'serio', 'img/perro_serio_juzgando.jpg', 'Comunidad'),
('Shaq: Tiempo Fuera', 'Momento... pará un poco la mano un segundo.', 'guino', 'img/shaq_timeout.jpg', 'Comunidad');

-- 3. Consulta de prueba para listar los memes por emoción
-- SELECT * FROM memes WHERE emocion = 'sonrisa' ORDER BY id DESC;

