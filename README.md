# Sonne Blocks

Un juego de bloques para navegador, hecho con TypeScript, Vite y Canvas 2D. Interfaz en español, diseño oscuro y controles pensados para móvil en vertical. Sin cuentas, servidor de aplicación, anuncios, compras, sonido ni dependencias externas durante el juego.

**[Jugar a Sonne Blocks](https://playsonne.github.io/sonne-blocks/)** · Puedes compartir este enlace; no hace falta una cuenta de GitHub.

## Empezar

Requiere **Node.js 22.12 o posterior** y npm. Desde esta carpeta:

```sh
npm ci
npm run dev
```

Abre la dirección que muestra Vite, normalmente `http://127.0.0.1:5173/`. En PowerShell, si la política de ejecución bloquea `npm.ps1`, utiliza `npm.cmd` en lugar de `npm`.

```sh
npm test             # Pruebas de lógica y persistencia
npm run build        # Comprobación de TypeScript y compilación a dist/
npm run preview      # Probar la compilación en http://127.0.0.1:4173/
npm run test:e2e     # Pruebas de navegador sobre una compilación previa
```

El service worker se registra **solo en la compilación de producción**. Usa `build` y `preview` para comprobar instalación y modo offline; el servidor de desarrollo no instala una caché que pueda ocultar los cambios.

Las pruebas de navegador usan Microsoft Edge instalado en el equipo. También pueden ejecutarse con Chrome, configurando `PW_BROWSER_CHANNEL=chrome`. En PowerShell: `$env:PW_BROWSER_CHANNEL='chrome'`. Para el Chromium de Playwright, instálalo con `npx playwright install chromium` y usa `PW_BROWSER_CHANNEL=chromium`. No es necesario descargar ningún navegador para jugar.

La batería de navegador sirve la compilación principal en el puerto 4283 y una compilación aislada en `dist-subpath/`, bajo `/TETRIS/`, en el puerto 4284. Ambos puertos deben estar disponibles; los servidores de prueba se cierran al terminar. Las capturas y los diagnósticos quedan en `test-results/`.

## Cómo jugar

Completa filas horizontales. El tablero tiene **10 columnas y 20 filas visibles**, con dos filas internas de entrada. Las siete piezas aparecen en bolsas aleatorias: cada bolsa contiene una de cada tipo.

| Acción | Teclado |
| --- | --- |
| Mover | Flechas izquierda / derecha |
| Caída suave | Flecha abajo |
| Girar a la derecha | Flecha arriba o X |
| Girar a la izquierda | Z |
| Caída instantánea | Espacio |
| Reservar / intercambiar | C |
| Pausar | Escape |

En móvil, **Botones** es el modo inicial. Mantener izquierda, derecha o abajo repite el movimiento y admite varios dedos. En **? → Controles en pantalla → Gestos** puedes activar el modo de un dedo: arrastra horizontalmente para mover, toca una mitad del tablero para girar hacia ese lado, arrastra hacia abajo para bajar o desliza rápido y recto hacia abajo para dejar caer al soltar. Toca **Reserva** para intercambiar; también admite foco, Enter y Espacio.

La primera selección de Gestos muestra una explicación con **Empezar con gestos**. Cerrar esa explicación conserva Botones. Tras aceptarla, la preferencia se guarda por separado de la partida y puedes cambiar de modo desde la ayuda. El teclado funciona en ambos. En Gestos se ocultan los botones y el tablero crece en el espacio libre. Al fijarse o intercambiarse una pieza, hay que levantar el dedo antes de controlar la siguiente. Dos contactos simultáneos cancelan el gesto completo.

Las pulsaciones se cancelan al pausar o perder el foco; los gestos también al interrumpirse el contacto o redimensionarse el tablero. Durante la partida, la superficie de juego completa (tablero, Reserva, botones y espacios entre ellos) restringe el desplazamiento y zoom táctiles del navegador en ambos modos. Ayuda y ajustes conservan el desplazamiento y la ampliación de texto, sin limitar el zoom global mediante el viewport. Consulta [umbrales, pruebas y capturas del modo Gestos](docs/GESTOS.md) y [la corrección del zoom accidental y sus límites de verificación](docs/ZOOM-MOVIL.md).

La sombra marca dónde aterrizará la pieza. La reserva solo se puede utilizar una vez antes de fijar la pieza actual. Los giros emplean ajustes SRS, con tabla específica para I; O conserva su orientación. Al tocar el suelo hay **500 ms** para ajustar la pieza, con **15 reinicios** como máximo. Los intentos de movimiento bloqueados no reinician ese margen.

| Líneas simultáneas | Puntos × nivel actual |
| --- | --- |
| 1 | 100 |
| 2 | 300 |
| 3 | 500 |
| 4 | 800 |

La caída suave añade 1 punto por casilla; la instantánea, 2. El nivel aumenta cada 10 líneas. La gravedad pasa de 900 ms por fila a `max(65, 900 × 0.8^(nivel − 1))` ms. No hay combos ni puntuación especial por giros en esta versión.

El juego termina si una pieza nueva o reservada no puede entrar o si una pieza se fija completamente sobre la zona visible. Para reiniciar, pausa y pulsa **Nueva partida**; la confirmación evita sustituirla por accidente. Al terminar puedes **Volver a jugar**.

### Resumen de partida y vibración (v1.1.0)

Al terminar se muestran **puntos, líneas, nivel y tiempo jugado**, con un aviso si superaste el récord que tenías al comenzar. El tiempo cuenta únicamente mientras avanza la partida: excluye pausas, ayuda y segundo plano, y se conserva al guardar y recuperar. «Volver a jugar» inicia una partida con tiempo y puntuación a cero y conserva el récord. Los guardados anteriores siguen siendo válidos; si no contienen duración, el resumen indica que el tiempo corresponde solo al tramo desde la actualización.

En **? → Vibración** puedes activar la respuesta táctil y pulsar **Probar vibración**. Está desactivada por defecto y se recuerda en el dispositivo, independientemente de Botones/Gestos. Una caída instantánea emite un pulso de 12 ms; completar líneas emite dos de 18 y 24 ms separados por 35 ms. Si una caída completa líneas se usa solo este último patrón. Mover y girar no vibran. Pausar, cambiar de aplicación o desactivar la opción cancela los pulsos pendientes.

Se usa la [API de vibración del navegador](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate): su presencia no garantiza que el dispositivo tenga motor o que sus ajustes permitan vibrar. Si falta, los ajustes lo indican y el juego continúa funcionando. Las pruebas automáticas comprueban las llamadas, su preferencia y sus cancelaciones; la sensación e intensidad reales requieren probarlo en el móvil. La animación de eliminación de filas y el sonido quedan para una mejora posterior.

## Distribución de pantalla

En móvil, la cabecera compacta da paso a una fila de puntos, récord, nivel y líneas, otra fila con reserva y siguiente, el tablero y los controles. No hay columna lateral. La ayuda **?** reúne la instalación, el estado del guardado y la disponibilidad offline; los avisos importantes siguen apareciendo y también se pueden consultar allí.

En escritorio, el conjunto de juego queda centrado, con estadísticas, vistas previas y botones al lado del tablero. Los botones siguen disponibles en equipos táctiles. El texto grande de presentación aparece únicamente al entrar por primera vez; durante la partida y la pausa se conserva una guía discreta de teclado.

El tablero aprovecha el menor límite entre el ancho y la mitad de la altura restante, con proporción 1:2 y casillas cuadradas. La distribución usa la altura dinámica de la ventana, reserva las zonas seguras y mide el espacio que queda después de los demás elementos. Un cambio de tamaño redibuja el tablero sin reiniciar ni sustituir la partida. Con poca altura o texto ampliado se permite desplazamiento, también dentro de los diálogos y la pausa.

La pausa muestra **Partida en pausa**, **Continuar** y **Nueva partida** sobre el tablero. La caída instantánea se diferencia por color y separación. Todas las acciones de juego, ayuda y pausa tienen un área táctil de al menos 44 × 44 píxeles CSS en los tamaños comprobados.

Consulta las [capturas y medidas del nuevo diseño](docs/VALIDACION.md#dimensiones-y-capturas-del-diseño-responsive).

## Pausa y guardado

- El bucle usa tiempo transcurrido e integra hasta los siguientes eventos de gravedad o fijación; no cuenta fotogramas.
- Cambiar de pestaña, bloquear la pantalla, perder el foco o abrir la ayuda pausa y guarda. Si un fotograma tarda más de 250 ms, se pausa como medida de protección frente a una suspensión del navegador.
- Al volver o recargar nunca se reanuda automáticamente. Pulsa **Continuar** o empieza otra partida.
- Se guarda después de cada pieza fijada, al pausar y al pasar a segundo plano. El estado incluye tablero, pieza activa y orientación, siguiente, reserva, permiso de reserva, bolsa restante, puntos, líneas, nivel y temporizadores.
- Los datos de `localStorage` tienen versión y validación estructural y lógica. Un guardado incompatible o dañado se descarta sin impedir jugar. El récord se guarda por separado.
- Si el navegador bloquea el almacenamiento o agota la cuota, el juego sigue en memoria y lo indica. Si el proceso se cierra de golpe antes de guardar, se recupera el último punto guardado.

El almacenamiento pertenece a este origen y navegador. Borrar los datos del sitio elimina partida y récord. No se sincroniza entre dispositivos ni se garantiza compartir datos entre Safari y la app instalada. Evita jugar partidas distintas a la vez en dos pestañas: comparten el mismo guardado y la última escritura prevalece.

## Instalar en Android

1. Abre el juego en Chrome desde una dirección HTTPS.
2. Abre la ayuda **?** y espera a ver **Listo para jugar sin conexión · guardado local** en la sección de instalación y almacenamiento.
3. Pulsa **Instalar el juego** dentro de esa ayuda y acepta el aviso si el navegador lo ofrece. También puedes usar **Instalar aplicación** o **Añadir a pantalla de inicio** en su menú.
4. Abre Sonne Blocks desde su icono. No necesitas mantener una conexión para jugar después de la carga completa.

## Instalar en iPhone o iPad

1. Abre la dirección HTTPS en **Safari**.
2. Abre la ayuda **?** y espera al indicador de disponibilidad sin conexión en la sección de instalación y almacenamiento.
3. Pulsa **Compartir → Añadir a pantalla de inicio**. Si aparece, activa **Abrir como app web** y confirma.
4. Abre el icono y deja que termine su primera carga antes de probar el modo avión.

El botón de instalación muestra estas instrucciones cuando no está disponible el aviso del navegador. La web funciona también sin instalarse. Los nombres de los menús pueden variar según el sistema y la versión.

## Modo offline y actualizaciones

El manifest, el icono Apple de 180 px, los iconos de 192 y 512 px y la variante maskable de 512 px son locales y originales. El símbolo vectorial está en `public/icons/sonne.svg`; los PNG se pueden regenerar con `node scripts/generate-icons.mjs`.

La compilación genera `dist/sw.js` con una lista de **todos** los recursos producidos y una versión derivada de su contenido. La instalación solo se completa si se pueden almacenar todos. La navegación utiliza el HTML de esa versión, evitando mezclar HTML y scripts de distintas compilaciones. La caché anterior se conserva para otras pestañas abiertas; las más antiguas se limpian, sin tocar cachés de otros sitios o ámbitos.

Una versión nueva espera. El aviso ofrece **Pausar y actualizar**: al pulsarlo se pausa, se guarda y se recarga; la partida recuperada queda en pausa. La aplicación nunca recarga automáticamente una partida en curso. Si otra pestaña activa una versión nueva, esta pestaña no se recarga por ello.

Debajo de **Sonne Blocks** se muestra discretamente la versión y un código corto de compilación, también durante la partida y la pausa: `v1.0.1 · abc1234`, por ejemplo. El número procede de `package.json` y el código se calcula a partir de los archivos generados y del service worker. Una compilación distinta cambia el código sin depender de la hora; en desarrollo aparece `dev`. El rótulo viaja dentro del HTML de esa versión y funciona sin conexión: no consulta un número nuevo al servidor mientras sigue ejecutando una copia antigua. Antes de aceptar una actualización conserva el código anterior; después muestra el de la versión cargada.

Un navegador o el sistema operativo puede borrar cachés por falta de espacio; en ese caso necesitarás conexión para volver a cargar. No es posible garantizar conservación indefinida del almacenamiento del navegador.

## Raíz de dominio o subcarpeta

El juego se publica en **https://playsonne.github.io/sonne-blocks/** mediante GitHub Pages. El repositorio es público y conserva el código fuente. El flujo `.github/workflows/pages.yml` ejecuta las pruebas unitarias, compila y publica únicamente `dist/` al subir cambios a `main`; también admite ejecución manual desde Actions. Un fallo en las pruebas o la compilación impide ese despliegue.

La configuración predeterminada `base: './'` genera rutas relativas y permite servir el mismo resultado en la raíz o una subcarpeta. Accede a la carpeta con barra final, por ejemplo `/TETRIS/`, o configura la redirección de `/TETRIS` a `/TETRIS/` en el alojamiento.

También puedes fijar la ruta antes de compilar mediante un archivo `.env.production.local`:

```dotenv
# GitHub Pages: https://USUARIO.github.io/TETRIS/
VITE_BASE_PATH=/TETRIS/
```

Para un dominio propio o `https://USUARIO.github.io/`, usa `VITE_BASE_PATH=/`. Otra opción puntual es:

```sh
npm run build -- --base=/TETRIS/
npm run preview -- --base=/TETRIS/
```

Si usas `.env.production.local`, `preview` lee la misma configuración de producción y no necesita repetir `--base`.

El manifest usa `start_url`, `scope`, `id` e iconos relativos a su ubicación. El registro del service worker sigue la base de Vite; sus recursos y su caché se delimitan al ámbito de esa instalación. No hace falta un servidor de aplicación ni reescrituras de rutas: hay una sola página.

GitHub Pages aloja el **contenido de `dist/`**, con rutas relativas que funcionan bajo `/sonne-blocks/`. Utiliza HTTPS en producción; `localhost` o `127.0.0.1` sirven para pruebas locales. Una URL HTTP con la IP de la red local permite probar la interfaz, pero normalmente **no** el service worker ni la instalación.

Referencias técnicas: [base y alojamiento estático de Vite](https://vite.dev/guide/static-deploy.html), [service workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) e [instalación de PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

## Organización

```text
src/game/          Piezas, bolsa, colisiones, SRS, puntuación y reloj
src/controls.ts    Teclado y botones; repetición, multitáctil y cancelación
src/gestures.ts    Reconocimiento de un dedo, umbrales y adaptación a Pointer Events
src/preferences.ts  Preferencia Botones/Gestos, separada de la partida
src/haptics.ts     Vibración opcional y cancelación de pulsos
src/session.ts     Metadatos del resumen y formato del tiempo jugado
src/render.ts      Tablero, sombra y vistas previas en Canvas 2D
src/persistence.ts Guardado versionado, validación y gestión de errores
src/pwa.ts         Instalación y aceptación explícita de actualizaciones
src/main.ts        Flujo de pantallas, pausa y conexión de componentes
src/service-worker.js  Plantilla de caché completada durante el build
public/           Manifest e iconos propios
tests/            Pruebas de lógica, persistencia e integración en navegador
docs/             Guía y resultados de comprobación
```

## Comprobaciones y límites

Consulta [la guía de comprobación en móviles reales](docs/COMPROBACION-MOVIL.md) y [los resultados de validación](docs/VALIDACION.md). La interfaz se ha comprobado en navegador de escritorio con tamaños de móvil; esto **no equivale a probar dispositivos físicos Android o iOS**. La instalación nativa, las zonas seguras reales y la suspensión del sistema quedan pendientes en hardware real.

Se prioriza móvil en vertical. En pantallas inusualmente bajas, horizontal o con ampliación elevada, puede ser necesario desplazarse para mantener legibles y utilizables los botones. La interfaz tiene nombres accesibles, controles por teclado, foco visible, diálogos y respeto a la reducción de movimiento; el tablero de Canvas no ofrece una modalidad completa de juego no visual para lectores de pantalla.
