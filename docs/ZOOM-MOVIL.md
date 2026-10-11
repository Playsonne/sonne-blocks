# Corrección del zoom accidental

Cambio local del 11 de octubre de 2026. El usuario confirmó previamente el buen funcionamiento de los gestos en su Xiaomi 14. Esta corrección no modifica su sensibilidad ni su reconocimiento. Sin publicación ni despliegue.

## Causa localizada y cambio

La revisión encontró `touch-action: none` en los botones inferiores y su contenedor, y en el Canvas únicamente en modo Gestos. El tablero en modo Botones, el recuadro Reserva, las vistas previas y los huecos de la zona de juego conservaban el comportamiento táctil del navegador. Los `preventDefault()` existentes en Pointer Events gestionaban los controles, pero no son un sustituto de declarar la política de desplazamiento y zoom antes del contacto.

La corrección añade una sola regla CSS, con dos destinos, mientras `data-game-status="playing"`:

- `.game`: cubre tablero, vistas previas, Reserva, botones y espacios entre ellos en los dos modos.
- `.board-wrap`: cubre también el límite de desplazamiento que ya existía por `overflow: hidden`. La evaluación de `touch-action` para desplazamiento termina en el contenedor de scroll más cercano; por eso no basta confiar únicamente en el contenedor exterior.

Ambos reciben `touch-action: none`. Con ello la superficie declara que los contactos se destinan al juego y no al desplazamiento, doble toque de zoom o pellizco del navegador. No se añaden escuchas `touchmove`, `touchend`, `gesturestart` ni `dblclick`. No se alteran Pointer Events, capturas, repetición, multitáctil, umbrales ni tiempos. Tampoco se cambia el viewport, el diseño, las dimensiones o las reglas del juego.

La regla deja de estar activa al pausar; los diálogos están fuera de `.game`. Ayuda y ajustes mantienen scroll y ampliación, sin restricciones en `html` o `body`. No se añade bloqueo de desplazamiento a toda la ventana ni interceptación de gestos del sistema en los bordes. El gesto de actualizar iniciado sobre el juego debe quedar impedido al impedirse el desplazamiento táctil de esa superficie; el comportamiento del navegador y del sistema fuera de ella se conserva.

Referencia: [Pointer Events, política de manipulación directa](https://www.w3.org/TR/pointerevents3/#the-touch-action-css-property) y [evaluación de la política entre el elemento y sus contenedores](https://www.w3.org/TR/pointerevents3/#determining-supported-direct-manipulation-behavior).

## Verificado mediante emulación

Microsoft Edge/Chromium en Windows, con Playwright, ventana móvil y contactos táctiles enviados por CDP. Las pruebas añadidas están en `tests/browser/touch-surface.spec.ts`.

- Antes del cambio, un arrastre desde el tablero en modo Botones desplazó la página 85 píxeles en una ventana baja. Después, arrastres arriba y abajo desde el tablero mantienen el desplazamiento en cero en ambos modos, incluso con contenido más alto que la ventana.
- Dos toques rápidos producen exactamente dos giros tanto sobre el tablero en Gestos como sobre el botón de giro. No se observa una acción de clic duplicada.
- Los contactos de pellizco en tablero, Reserva y espacios entre elementos no producen desplazamiento ni acciones de tablero inesperadas. La política CSS impide pan/zoom en los dos límites correspondientes.
- Botones conserva izquierda y caída suave simultáneas, repetición y liberación sin movimiento residual. La batería existente verifica también arrastres, inversión, caída única, segundo dedo y cancelaciones en Gestos.
- La ayuda responde al arrastre táctil; con texto al 200 % permite desplazarse, cambiar el selector y alcanzar el botón de cierre. Sus reglas y las del viewport siguen permitiendo ampliar.
- La batería existente vuelve a comprobar proporción y dimensiones del tablero, controles, guardado, recuperación y funcionamiento offline.

**Límite importante:** esta emulación mantuvo la escala en 1 incluso al intentar ampliar la ayuda sin restricciones, tanto con dos contactos como con el sintetizador de pellizco del navegador. Por tanto, una escala estable sobre el juego no demuestra por sí sola el bloqueo del zoom nativo. No se atribuye a esta prueba una validación física del pellizco, doble toque de zoom, recarga al arrastrar o gestos de Android/iOS. No se ha simulado la escala directamente para presentarla como resultado de un pellizco.

## Comprobar físicamente en Android e iOS

En Chrome del Xiaomi 14 y Safari de iPhone/iPad, probar ambos modos durante una partida:

1. Doble toque rápido sobre tablero, botones, Reserva y huecos. La escala debe permanecer estable; en Gestos cada toque debe girar una sola vez.
2. Pellizcar y añadir un segundo dedo. Gestos debe cancelar el contacto como antes; Botones debe conservar las combinaciones de controles intencionadas sin zoom ni acciones adicionales.
3. Arrastrar hacia arriba y abajo desde la superficie, incluyendo desde la parte superior de la página. No debe desplazarse ni aparecer el gesto de actualizar.
4. Abrir ayuda: desplazar su contenido, ampliar mediante pellizco y aumentar el tamaño de texto del navegador. Los ajustes deben seguir accesibles.
5. Repetir con barras del navegador visibles/ocultas y, si ya está instalada, en la PWA. Comprobar que los gestos del sistema desde los bordes siguen funcionando.

No hace falta volver a afinar la sensibilidad: los archivos que reconocen los gestos y controlan los botones permanecen intactos. Los resultados totales de pruebas y compilación están en [Validación](VALIDACION.md).
