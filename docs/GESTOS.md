# Control por gestos

Implementado el 11 de octubre de 2026. No se ha publicado ni desplegado. **El usuario confirmó que los gestos funcionan bien en su Xiaomi 14.** La corrección posterior del zoom conserva exactamente el reconocedor y sus umbrales; su comprobación física se detalla en [Zoom móvil](ZOOM-MOVIL.md).

## Activación y uso

El modo inicial sigue siendo **Botones**, con su repetición y comportamiento multitáctil. Abre **? → Controles en pantalla → Gestos**. La primera selección presenta cinco instrucciones y **Empezar con gestos**; ese botón acepta el modo y continúa la partida, o empieza una si aún no existe. Cerrar la explicación vuelve a los ajustes conservando Botones. Las selecciones posteriores no repiten la explicación; cerrar la ayuda deja la partida en pausa hasta pulsar Continuar.

En Gestos se juega con un dedo desde cualquier punto del tablero, sin tener que tocar la pieza. Se puede invertir un arrastre horizontal sin levantar el dedo. Un toque a cada lado gira hacia ese lado. Un arrastre descendente baja por filas; solo un deslizamiento suficientemente largo, rápido y vertical produce caída instantánea, una vez, al soltar. El recuadro Reserva funciona como botón en ambos modos, con nombre accesible, foco visible, Enter y Espacio. Conserva el límite de un intercambio por pieza.

El teclado sigue disponible en los dos modos. Los botones inferiores desaparecen en Gestos; ayuda, pausa y Reserva permanecen visibles. Los diálogos reciben sus propios contactos. No se cambia el motor, las reglas, el formato de las partidas ni los archivos responsables de la PWA. Los desplazamientos hacia abajo usan las acciones existentes: 1 punto por fila de caída suave y 2 por cada fila restante de caída instantánea.

## Umbrales ajustables

La función `gestureThresholds` de `src/gestures.ts` reúne los valores. Las medidas son **píxeles CSS**, no píxeles físicos; `c` es el ancho visible del tablero dividido entre 10. Se calculan al comenzar cada contacto. Un cambio de tamaño cancela el contacto y el siguiente utiliza la nueva escala.

| Criterio | Valor inicial |
| --- | --- |
| Duración máxima de un toque | 250 ms |
| Desviación máxima de un toque | `max(6, min(10, 0,25 × c))`, distancia euclídea desde el inicio |
| Umbral para decidir el eje y emitir el primer paso | `max(8, min(14, 0,35 × c))` |
| Dominancia para bloquear el eje | Distancia en ese eje ≥ 1,5 veces la del otro |
| Pasos posteriores de arrastre | Una columna o fila por cada `c` píxeles desde el último paso |
| Distancia mínima de caída instantánea | `max(60, 3 × c)` hacia abajo |
| Duración máxima de caída instantánea | 300 ms desde el primer contacto hasta soltar |
| Velocidad media mínima de caída instantánea | `max(0,65, 0,025 × c)` píxeles/ms |
| Desviación lateral máxima durante toda la caída | Menor entre `0,75 × c` y el 20 % del descenso final |
| Retroceso vertical acumulado máximo para una caída | La tolerancia del toque |

Una trayectoria que supera la tolerancia del toque nunca gira al finalizar, aunque regrese al punto inicial o no consiga bloquear un eje. Una vez elegido un eje no cambia durante ese contacto. Subir el dedo en un arrastre vertical reposiciona el punto de referencia sin subir la pieza; un dedo inmóvil no repite pasos. Los pasos horizontales consumen distancia incluso junto a una pared, evitando acumular movimientos contra el límite.

La caída instantánea debe cumplir **todos** los criterios. Un recorrido corto, lento, demasiado diagonal, con retroceso excesivo o que comenzó bloqueando el eje horizontal no deja caer al soltar. Se procesan también las muestras agrupadas por el navegador cuando están disponibles, para conservar los desvíos y cambios de dirección.

## Cancelaciones y aislamiento

El reconocedor conserva una identidad de pieza basada en las fijaciones y el estado de reserva, sin añadir campos al guardado. Comprueba esa identidad y el permiso de jugar antes de cada paso. La fijación por gravedad, una caída con teclado y un intercambio cancelan el contacto; la siguiente pieza necesita uno nuevo. La caída al soltar elimina el contacto antes de emitir la acción, por lo que no se duplica.

La adaptación utiliza exclusivamente **Pointer Events** y captura del puntero. No se añaden acciones de tablero en `touch` o `click`. Un segundo contacto cancela el gesto completo; retirarlo no reactiva el primero. Tampoco se activa Reserva con ese segundo contacto. Su activación por teclado sigue permitida.

Se cancela al pausar, abrir ayuda, iniciar otra partida, cambiar de modo, perder foco, ocultarse o salir de la página, recibir `pointercancel`, perder captura, cambiar la ventana o su área visual, y cambiar el tamaño efectivo del Canvas. Las interrupciones de página limpian también los contactos registrados. No hay temporizadores de movimiento que puedan quedarse activos.

Durante la partida, `touch-action: none` cubre la superficie de juego en ambos modos, incluido el contenedor del tablero, Reserva y los espacios entre controles. Los botones y el Canvas en Gestos conservan además sus reglas anteriores. Ayuda, pausa superpuesta y menús pueden desplazarse con poca altura o texto ampliado; no se añade una restricción global al viewport.

## Preferencia local

La clave independiente `sonne-blocks:controls:v1` guarda versión, modo y aceptación de la explicación. Las claves de partida y récord no cambian. Datos inválidos, versiones desconocidas o una preferencia de Gestos sin explicación aceptada vuelven a Botones. Si el almacenamiento está bloqueado, el modo funciona en memoria y se muestra un aviso de que la preferencia no se pudo guardar.

## Comprobación y capturas

Las pruebas se ejecutaron en Windows con Microsoft Edge/Chromium, Playwright y entrada táctil emulada, incluida densidad de píxeles 2,625. **No se usó un móvil físico ni se comprobó la instalación nativa en Android.**

- Pruebas unitarias: límites de distancia y duración; escala de tablero; giro a ambos lados; cambio de dirección; bloqueo de eje; arrastre sin giro; descenso controlado; rechazo de caídas cortas, lentas, diagonales, ascendentes o con retroceso; caída única al soltar; reemplazo de pieza y cancelación durante un evento; preferencia, recuperación y errores de almacenamiento.
- Navegador: activación inicial y cancelación de la explicación, persistencia, cambio a Botones sin reiniciar, teclado en ambos modos y Reserva táctil/Enter/Espacio. Movimiento inverso, arrastre lento, caída al soltar y exactamente cuatro casillas fijadas por cada caída en un tablero vacío.
- Cancelación por pausa, desenfoque, visibilidad simulada, evento de salida de página simulado, cambio de tamaño, cancelación táctil y pérdida de captura. Fijación natural con el dedo aún apoyado; la nueva pieza queda intacta hasta otro contacto. Dos dedos, incluido un segundo dedo en Reserva.
- Recuperación y gestos tras recarga sin red, además de las pruebas anteriores de caché, actualización PWA y subcarpeta. Se conservan las comprobaciones de botones multitáctiles y de comportamiento originales.
- Tablero completo, proporción 1:2, casillas cuadradas, ausencia de desbordamiento y controles de ayuda, pausa y Reserva ≥ 44 × 44 CSS px. Ayuda y explicación utilizables a 360 × 400 con texto al 200 %.

| Ventana móvil emulada | Tablero en Gestos, sin borde (CSS px) | Captura |
| --- | --- | --- |
| 360 × 640 | 243,7 × 487,3 | [Ver](capturas-gestos/gestos-360x640.png) |
| 390 × 844 | 342,5 × 685,0 | [Ver](capturas-gestos/gestos-390x844.png) |
| 412 × 915 | 378,0 × 756,0 | [Ver](capturas-gestos/gestos-412x915.png) |

Las capturas proceden del juego real con una partida de prueba; no son diseños simulados. La batería reproduce las imágenes en `test-results/`. El [informe general](VALIDACION.md) recoge el resultado completo de pruebas y compilación.

## Prueba física y ajustes futuros

El usuario ha probado los gestos en Xiaomi 14 y comunica que funcionan bien. Se conservan sus valores actuales. Si más adelante se desea afinarlos, comprobar primero el umbral horizontal y la inversión con el pulgar, después los toques junto a arrastres y por último el descenso lento frente al deslizamiento deliberado. Cualquier ajuste de distancia, velocidad o desviación exige repetir las pruebas de límites.

La confirmación del usuario no se presenta como una prueba física realizada por el agente ni como validación de iOS. La nueva restricción de zoom, el gesto de actualizar, las barras del navegador, el modo instalado y los bordes del sistema requieren las comprobaciones físicas indicadas en [Zoom móvil](ZOOM-MOVIL.md).
