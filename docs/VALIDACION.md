# Validación de Sonne Blocks

## v1.2.0 · Animación opcional de filas

Validado el **11 de octubre de 2026** en Windows y Microsoft Edge mediante Playwright: **85 pruebas unitarias y 70 pruebas de navegador aprobadas**, además de la compilación de producción. Son seis pruebas unitarias y nueve de navegador adicionales; se mantienen las comprobaciones anteriores de controles, gestos, multitáctil, guardado, actualización y funcionamiento offline.

- Se comprueban los índices y colores originales de las filas antes de compactar el tablero, incluso con filas no contiguas. El efecto dura **260 ms**, se limita a las filas visibles y no forma parte del guardado.
- El navegador usa un reloj controlado y lee píxeles reales del Canvas: el efecto aparece tras completar una o cuatro filas y desaparece al terminar su duración. Los puntos, la eliminación de filas y la siguiente pieza se actualizan inmediatamente; esta última responde durante la animación.
- Desactivar «Animación de filas» conserva los mismos puntos, tablero y aviso de líneas, sin animarlo. La preferencia persiste tras recargar sin conexión y no altera los ajustes de Gestos ni de vibración. Los ajustes antiguos conservan compatibilidad.
- La reducción de movimiento del sistema suprime la animación al cargar y cancela un efecto en curso sin alterar la partida ni sobrescribir la preferencia elegida. Se comprueban también las cancelaciones al pausar, redimensionar y fijar otra pieza, y que continuar no repite efectos anteriores.
- [Captura móvil emulada a 390 × 844 durante el efecto](animacion-filas-movil.png). El efecto queda debajo de la pieza activa y su sombra. No se añaden sonidos ni se modifican los umbrales de gestos, el diseño o las restricciones táctiles.

**No se han realizado pruebas físicas de esta animación en Android ni iOS.** La fluidez y la comodidad visual en el Xiaomi 14 quedan pendientes de la prueba del usuario.

## v1.1.0 · Resumen y vibración opcional

Validado el **11 de octubre de 2026** en Windows y Microsoft Edge mediante Playwright. **79 pruebas unitarias aprobadas**, compilación correcta y **61 comprobaciones de navegador aprobadas** (las 49 existentes y 12 nuevas; las nuevas se repitieron tras ajustar la sincronización/entrada de la prueba). Sin cambios en el reconocedor de gestos, los controles de teclado/botones ni las reglas CSS que restringen el zoom.

- Resumen al terminar: puntos, líneas, nivel y tiempo jugado; récord comparado con el existente al iniciar, incluso después de recuperar una partida. Empatar o quedar por debajo no anuncia un nuevo récord. Reiniciar pone a cero el tiempo y los puntos y mantiene el récord.
- El contador suma únicamente el tiempo integrado por el motor. Se probaron pausas, fin de partida a mitad de un intervalo, guardado y recarga sin red, sin duplicar tiempo. Los metadatos se guardan junto al tablero; los guardados antiguos o con metadatos inválidos conservan la partida y muestran una duración explícitamente parcial.
- Resumen completo y botón accesible en 360 × 640; con 360 × 400 y texto al 200 % se puede desplazar hasta «Volver a jugar», sin desbordamiento horizontal. [Captura móvil emulada](resumen-movil.png).
- Vibración inicialmente desactivada, preferencia persistente y botón de prueba; falta de API, errores y rechazo de la petición no afectan al juego. [Ajuste de vibración en emulación](ajuste-vibracion.png).
- Se interceptó la API de vibración para comprobar pulsos de caída (12 ms), líneas (18/35/24 ms), ausencia de duplicados en caída + línea, ausencia de vibración en giros y funcionamiento con Botones y Gestos. Se verificó cancelación al pausar, desactivar y perder foco. **Esto comprueba las llamadas; no la vibración física ni su intensidad.**
- Las pruebas originales siguen comprobando multitáctil en Botones, cancelación de gestos, guardado, actualización PWA y juego offline. No se ha añadido animación de filas ni sonido en esta entrega.

**Observación pendiente en un dispositivo real:** tras un deslizamiento rápido generado mediante CDP, Chromium descartó el primer clic táctil emulado sobre Pausa (el segundo sí pausó). La misma secuencia produjo el mismo resultado en la web publicada v1.0.1 y en la v1.1.0 local, sin ser una regresión de estos cambios. La comprobación de cancelación tras ese deslizamiento usa Escape; otras pruebas cubren Pausa con toque. Conviene comprobar un toque en Pausa justo después de un deslizamiento en el Xiaomi 14. No se atribuye el fallo a dispositivos físicos ni se considera resuelto. La respuesta real de vibración sigue pendiente de prueba en hardware.

Referencias: [API de vibración](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate) y [especificación W3C](https://www.w3.org/TR/vibration/). La detección de la API no confirma que exista un motor ni que los ajustes del sistema permitan activarlo.

## Historial: v1.0.1

Comprobaciones actualizadas el **11 de octubre de 2026** tras añadir la versión visible para diagnosticar las actualizaciones y el zoom comunicado por el usuario, en Windows con Node.js 22.12.0 y Microsoft Edge 155.0.4283.45 (Chromium), mediante Playwright. Estos resultados corresponden a la validación local previa a la primera publicación en GitHub Pages.

## Resultado

| Comprobación | Resultado |
| --- | --- |
| `npm test` | **65 pruebas aprobadas**, incluidas 30 nuevas de gestos y preferencias |
| `npm run build` | **Correcto**, TypeScript y compilación de producción |
| `npm run test:e2e` | **49 pruebas aprobadas**: 21 originales, 20 de Gestos y 8 de superficie táctil; servidores cerrados al terminar |
| Auditoría al instalar dependencias (10 de octubre) | 0 vulnerabilidades comunicadas por npm en esa instalación; no se añadieron dependencias con el rediseño |
| Recursos externos necesarios para jugar | Ninguno |

La compilación principal contiene aproximadamente 23,3 kB de JavaScript y 13,6 kB de CSS sin comprimir, además del HTML, manifest, service worker e iconos locales. No se añadieron dependencias para los gestos ni para la corrección táctil.

Los archivos del motor, piezas, controles de botones/teclado, persistencia de partida, instalación PWA y service worker no se han modificado al añadir Gestos. El reconocedor y la preferencia se implementan en archivos independientes, conectados desde la interfaz. Las pruebas de comportamiento originales se mantienen; la comprobación de áreas táctiles también incluye ahora el recuadro Reserva.

Consulta [Gestos: umbrales, cancelaciones, verificación y capturas](GESTOS.md). Se probaron movimientos, giros, caída única al soltar, ausencia de giro tras arrastre, aislamiento tras fijación/intercambio, segundo contacto, interrupciones y recuperación sin red. El usuario confirmó que los gestos funcionan bien en su **Xiaomi 14**; la corrección posterior de zoom conserva esos valores y eventos.

La [corrección del zoom accidental](ZOOM-MOVIL.md) añade únicamente una regla CSS durante la partida. Se reprodujo y corrigió el desplazamiento desde el tablero en Botones; se verificaron dos giros para dos toques rápidos, arrastres, botones multitáctiles, ayuda desplazable y texto al 200 %. Los archivos de reconocimiento, botones, flujo, motor, renderizado, persistencia y viewport mantienen los mismos hashes anteriores al cambio. **El zoom nativo no se pudo reproducir en esta emulación, ni siquiera en la ayuda sin restricciones.** El pellizco, doble toque de zoom, gesto de actualizar y gestos de borde de Android/iOS necesitan comprobación física; una escala emulada estable no se toma como prueba suficiente de su bloqueo.

### Versión visible: v1.0.1

El usuario comunica que el pellizco hacia fuera aún amplía en el móvil. Esto sigue pendiente de diagnóstico; no se considera resuelto por añadir una etiqueta. La cabecera muestra ahora la versión y los primeros siete caracteres del identificador de caché de la compilación. La compilación principal actual muestra **v1.0.1 · 30835d4**; otra base o cambios en los archivos pueden producir otro código.

La batería completa vuelve a aprobar las 65 pruebas unitarias y 49 de navegador, además de la compilación. Se comprueba que el código mostrado coincide con el generado, que es visible en móvil y escritorio durante partida y pausa, y que se conserva al recargar sin red. La prueba de actualización cambia tanto el HTML como la versión del service worker: mientras espera se ve la etiqueta antigua; después de aceptar se muestra la nueva y se recupera la partida pausada. Los archivos de gestos y botones permanecen intactos. La [captura móvil](version-movil.png) procede de emulación a 390 × 844.

## Lógica y persistencia

Se probaron colisiones con los cuatro límites y bloques, sombra y aterrizaje, cuatro giros completos de las siete piezas, giros a ambos lados, ajustes de I y T junto a paredes y suelo, ajustes junto a bloques y rechazo de giros imposibles. También eliminación de una a cuatro líneas simultáneas, desplazamiento de filas, puntos y cambio de nivel.

La bolsa se comprobó individualmente y a través del flujo de 28 piezas. Se verificaron reserva, bloqueo de un segundo intercambio, habilitación tras fijar y situaciones de fin de partida.

Las pruebas de tiempo compararon avances a 30, 60 y 144 FPS; comprobaron el margen de 500 ms, sus 15 reinicios máximos, movimientos fallidos y ausencia de avance durante la pausa.

La persistencia se comprobó con recuperación completa siempre pausada, continuidad del orden de piezas, versiones inválidas, JSON dañado, coordenadas y contadores incoherentes, almacenamiento que lanza errores y conservación del récord al terminar.

## Navegador

- Escritorio: **1366 × 768**, **1920 × 1080** y la comprobación anterior de **1440 × 1000**. Revisión visual de capturas de bienvenida, partida y pausa.
- Móvil simulado: **360 × 640**, **390 × 844**, **412 × 915** y **320 × 568**. Se comprobó ausencia de desbordamiento horizontal y vertical en los tamaños habituales, tablero completo con proporción 1:2 y controles dentro de la pantalla.
- Se verificó que las cuatro estadísticas preceden a las vistas previas, que reserva y siguiente comparten fila, y que el tablero queda centrado. Solo existe una vista de siguiente pieza.
- El tamaño coincide con el máximo que cabe en el espacio disponible. Todas las acciones de juego, ayuda y pausa conservan un área de al menos 44 × 44 píxeles CSS; en móvil se comprueba además una separación de al menos 12 píxeles antes de la caída instantánea.
- Contexto móvil con entrada táctil y densidad **2,625**: se verificaron dimensiones CSS, proporción del búfer de Canvas, reserva, caída y pausa mediante toques emulados.
- Cambios de altura 844 → 690 → 844, paso por orientación horizontal y escritorio, y regreso a móvil: el estado guardado se conserva. Un cambio de tamaño durante la partida mantiene el juego activo, y la recarga posterior recupera el estado en pausa.
- Se inyectaron márgenes seguros de **44 px arriba y 34 px abajo** para comprobar la reserva de espacio. Esto simula insets, no una instalación real en iPhone.
- Ventana **360 × 400**, texto normal y al **200 %**: desplazamiento de página y diálogos, ausencia de solapamiento entre cabecera y estadísticas, confirmación/cancelación de nueva partida, conservación del récord y acceso al botón de instalación. También se revisó una captura de la ayuda con texto ampliado.
- Movimiento, rotación, reserva, caída instantánea, pausa y recuperación tras recargar.
- Repetición de teclado y prioridad entre direcciones opuestas.
- Dos contactos táctiles generados por el motor Chromium, liberación de un dedo, cancelación y ausencia de movimiento residual. Esto es **emulación de entrada**, no una prueba de pantalla táctil física.
- Pérdida de foco y cierre de ayuda: la partida se mantiene pausada y requiere continuar. No se simuló la suspensión real del proceso por iOS o Android.
- Guardado corrupto y almacenamiento bloqueado: sigue siendo posible empezar y jugar.
- Manifest en español, modo standalone, iconos locales y variante maskable. Estado de almacenamiento y ayuda de instalación accesibles desde **?**, sin mantener dos diálogos abiertos a la vez. No se aceptó ni comprobó un diálogo nativo de instalación.
- Después de completar la caché, desconexión de la red mediante Playwright, recarga, recuperación de la partida y nueva caída instantánea **sin red**.
- Cambio de versión del service worker durante la partida: el aviso espera, el juego no se interrumpe y, al aceptar, se guarda y recarga en pausa.
- Compilación con base **`/TETRIS/`**: ámbito del service worker, ruta de apertura del manifest y recursos dentro de la subcarpeta. Recarga, recuperación y juego sin red también aprobados allí.

Las capturas reproducibles se generan en `test-results/` al ejecutar la batería de navegador. Esta carpeta se ignora en Git porque contiene resultados de cada ejecución.

## Dimensiones y capturas del diseño responsive

Medidas del área dibujada, sin borde, en píxeles CSS. Las medidas anteriores se tomaron sobre la compilación previa, en el mismo navegador. Las capturas usan una partida de prueba guardada para mostrar las mismas piezas y puntuación en todos los tamaños.

| Ventana | Altura anterior del tablero | Tablero nuevo (ancho × alto) | Captura |
| --- | ---: | ---: | --- |
| Móvil 360 × 640 | 385 | 193,7 × 387,3 | [Ver](capturas-responsive/movil-360x640-jugando.png) |
| Móvil 390 × 844 | 522 | 291,5 × 583,0 | [Ver](capturas-responsive/movil-390x844-jugando.png) |
| Móvil 412 × 915 | 566 | 327,0 × 654,0 | [Ver](capturas-responsive/movil-412x915-jugando.png) |
| Escritorio 1366 × 768 | 443 | 316,5 × 633 | [Ver](capturas-responsive/escritorio-1366x768-jugando.png) |
| Escritorio 1920 × 1080 | 575 | 472,5 × 945 | [Ver](capturas-responsive/escritorio-1920x1080-jugando.png) |

Otras capturas: [pausa móvil](capturas-responsive/movil-390x844-pausa.png), [pausa en escritorio](capturas-responsive/escritorio-1920x1080-pausa.png), [bienvenida](capturas-responsive/escritorio-bienvenida.png) y [ayuda con texto al 200 % y poca altura](capturas-responsive/ayuda-altura-400-texto-200.png).

Estas medidas y capturas corresponden al modo **Botones**, con Reserva de al menos 44 px de altura. En el móvil más corto la mejora de tamaño es pequeña porque se prioriza mantener los botones completos y su área táctil. En los demás tamaños la altura ganada es mayor. Ningún caso fuerza el tablero a ocupar todo el ancho a costa de ocultar los controles. En Gestos el tablero alcanza 487,3, 685,0 y 756,0 px de altura en los tres móviles de la tabla, respectivamente.

## Pendiente en equipos reales

Las capturas de PC y Android aportadas por el usuario se usaron como referencia del diseño anterior. La nueva distribución se ha verificado mediante ventanas y entrada emuladas, sin una nueva prueba física en Android o iOS. Quedan pendientes Safari/WebKit, instalación desde los menús reales, zonas seguras físicas, cambios reales de las barras del navegador, modo instalado y suspensión/expulsión de caché por el sistema operativo. Tampoco se ha hecho una auditoría completa de accesibilidad o de consumo de batería. El tablero requiere visión; no hay modalidad de juego no visual.

Sigue [la guía de comprobación móvil](COMPROBACION-MOVIL.md) antes de distribuir la aplicación. El diseño prioriza vertical; las pantallas excepcionalmente bajas o el zoom elevado pueden necesitar scroll. Varias pestañas en el mismo origen comparten el guardado, sin coordinación de partidas simultáneas.
