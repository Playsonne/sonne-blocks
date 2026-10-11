# Comprobación en móviles reales

Guía pendiente de ejecutar en dispositivos físicos. Anota modelo, versión de Android/iOS, navegador, fecha y resultado. Prueba al menos un Android con Chrome y un iPhone con Safari, tanto en navegador como después de instalar.

## Preparación

1. Ejecuta `npm ci`, `npm test` y `npm run build`.
2. Sirve `dist/` mediante un origen HTTPS accesible desde el móvil cuando se autorice alojar una versión de pruebas. No abras `index.html` como archivo local.
3. Para probar solo la interfaz dentro de tu red, puedes ejecutar `npm run dev -- --host 0.0.0.0` y abrir `http://IP-DEL-EQUIPO:5173/`. Esa dirección HTTP no verifica PWA ni offline. No cambies reglas del cortafuegos sin entender su alcance.
4. Para comprobar la PWA se necesita la compilación de producción y HTTPS con certificado confiable, o una conexión de desarrollo que el dispositivo considere localhost.

## Pantalla y controles

- [ ] En vertical se ven cabecera compacta, fila de puntos/récord/nivel/líneas, fila de reserva/siguiente, tablero completo y los siete botones de juego sin scroll. No hay columna lateral.
- [ ] Se mantiene la proporción 1:2 y las casillas cuadradas al cambiar de tamaño. Las acciones tienen al menos 44 × 44 píxeles CSS y la caída instantánea está claramente diferenciada.
- [ ] Con poca altura o tamaño de texto ampliado, se puede desplazar la página y los diálogos; la ayuda, Continuar y Nueva partida siguen siendo accesibles.
- [ ] Ni la cámara ni el indicador de inicio del iPhone tapan controles. Repite con la barra del navegador visible y oculta y con la app instalada.
- [ ] Izquierda/derecha mueven una casilla inmediatamente y repiten de forma controlada al mantener el dedo.
- [ ] Abajo repite la caída suave. Gira en ambos sentidos y deja caer al instante.
- [ ] Mantén izquierda y abajo a la vez; levanta solo un dedo. El otro sigue funcionando.
- [ ] Mantén izquierda y después derecha. La última dirección tiene prioridad; al soltarla se recupera la otra sin una ráfaga acumulada.
- [ ] Arrastra el dedo fuera del botón, suelta y vuelve a pulsar. No quedan movimientos atascados.
- [ ] Interrumpe un toque con el centro de control, una notificación o cambio de aplicación. No continúa moviéndose al volver.
- [ ] Los toques rápidos no desplazan ni amplían la zona de controles. La ayuda se puede desplazar y el resto de la interfaz conserva el zoom del navegador.

## Partida y recuperación

- [ ] La sombra predice el aterrizaje. La siguiente pieza coincide con la que entra.
- [ ] La reserva solo se permite una vez por pieza; se habilita después de fijarla.
- [ ] Prueba giros junto a las paredes, el suelo y una pila de bloques.
- [ ] Completa una, dos, tres y cuatro líneas; comprueba puntos, líneas y subida de nivel cada diez líneas.
- [ ] Pausa, espera 30 segundos y continúa: no se acumula caída.
- [ ] Cambia de aplicación y bloquea la pantalla durante al menos un minuto. Al volver la partida sigue en pausa.
- [ ] Cierra y abre de nuevo. Se ofrece continuar o empezar otra; nunca se inicia sola.
- [ ] Empieza otra y comprueba que se confirma la sustitución y se conserva el récord.
- [ ] Termina una partida. Al reabrir no se ofrece recuperar una partida terminada.

## Instalación y modo avión

- [ ] Android: abre **? → Instalar el juego**, comprueba el aviso de instalación y la alternativa en el menú de Chrome.
- [ ] iOS: abre Safari y usa Compartir → Añadir a pantalla de inicio; activa Abrir como app web si se ofrece.
- [ ] El nombre, icono, color de fondo y modo sin barra del navegador son correctos.
- [ ] Abre la app instalada con conexión y consulta «Listo para jugar sin conexión» en la ayuda **?**.
- [ ] Activa modo avión, cierra la app, vuelve a abrirla y recupera la partida. Juega, guarda y recarga de nuevo.
- [ ] Repite desde el navegador sin instalar.
- [ ] Comprueba qué datos comparten el navegador y la app instalada; no asumas que comparten almacenamiento.

## Actualización, subcarpeta y errores

- [ ] Con una partida activa, sirve una compilación nueva en el mismo origen. El aviso no debe recargar ni detener la partida por sí solo.
- [ ] Pulsa Pausar y actualizar. Tras la recarga se conserva la partida y se ofrece Continuar.
- [ ] Mantén otra pestaña abierta: aceptar la actualización en una no debe recargar la otra.
- [ ] Repite la instalación y la prueba de modo avión en una subcarpeta, comprobando que la app se abre dentro de ella.
- [ ] Si puedes restringir almacenamiento, comprueba que se informa del problema y sigue siendo posible jugar.

| Dispositivo / sistema | Navegador / instalado | Resultado | Incidencias |
| --- | --- | --- | --- |
| Android (pendiente) | Chrome / app | Pendiente | — |
| iPhone (pendiente) | Safari / app | Pendiente | — |
