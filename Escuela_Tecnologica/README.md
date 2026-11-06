# Escuela Tecnológica — Versión para Netlify

Abre **GUIA_NETLIFY.html** para actualizar el sitio y **CONFIGURAR_ACCESO.html** para preparar claves nuevas.

## Cambios de esta versión

- Botón de WhatsApp flotante en la esquina inferior izquierda, también en celulares.
- Aviso superior de prueba eliminado. Se conserva el diseño y los ocho cursos.
- Comprobación de configuración en el acceso al administrador. Indica variables pendientes sin revelar sus valores.
- Usuario y contraseña validados en las funciones de Netlify. El generador local no configura Netlify automáticamente.
- Catálogo compartido conservado en Netlify Blobs. Actualizar los archivos no reemplaza los contenidos ya guardados en el mismo proyecto.

## Actualizar el proyecto existente

1. Extrae el ZIP. Sube el contenido de la carpeta extraída al MISMO repositorio conectado con tu proyecto actual de Netlify.
2. Conserva juntas las carpetas `public`, `lib`, `netlify`, `scripts` y `test`, y los archivos `package.json`, `package-lock.json` y `netlify.toml`. No cambies sus nombres. No subas solamente `index.html` ni el ZIP sin extraer.
3. En Netlify, verifica: rama `main`, Base directory vacía, Build command `npm run build`, Publish directory `public` y Functions directory `netlify/functions`.
4. Sigue las instrucciones de claves que aparecen debajo y realiza un despliegue de producción. No crees un proyecto nuevo ni borres el almacenamiento para hacer esta actualización.

## Corregir la contraseña

Las claves que se muestran en una captura deben reemplazarse. No las publiques ni las compartas nuevamente.

1. Abre `CONFIGURAR_ACCESO.html` en tu computadora y genera valores NUEVOS una sola vez. La pantalla genera claves, pero no las envía ni las guarda en Netlify. Guarda la contraseña en tu gestor de contraseñas antes de cerrar.
2. Entra a Netlify, abre tu proyecto y ve a **Project configuration → Environment variables**.
3. Crea o edita estas tres variables. Usa exactamente estos nombres, en mayúsculas:

| Key | Value | Para qué sirve |
| --- | --- | --- |
| ADMIN_USERNAME | admin | Usuario para entrar al panel |
| ADMIN_PASSWORD | La contraseña nueva | Contraseña que sí escribes en el acceso al administrador |
| SESSION_SECRET | La clave interna nueva | Protege las sesiones; NO se usa para ingresar |

La contraseña debe tener entre 16 y 256 caracteres; la clave interna al menos 32. El generador ya cumple esos requisitos. Copia solo el valor: sin comillas, etiquetas ni saltos de línea. Si elegiste un nombre distinto de `admin`, utiliza exactamente ese usuario al ingresar.

4. Para cada variable, el alcance (**Scopes**) debe incluir **Functions**. Si tu plan solo muestra todos los alcances, deja todos activados. Si puedes elegir el contexto, configura **Production**. No basta con permitir solo Builds.
5. Guarda las tres variables. Abre **Deploys → Trigger deploy → Deploy project**. Si el menú muestra “Clear cache and deploy project”, también puedes usar esa opción. Espera a que el despliegue más reciente sea el publicado en producción. Cambiar las variables sin volver a desplegar no actualiza la función que está atendiendo el acceso.
6. Abre el dominio principal de tu proyecto, no un enlace antiguo de Deploy Preview. Recarga con **Ctrl + F5**. En un celular, cierra la pestaña anterior y vuelve a abrir la dirección.
7. Abre **Administrador** y pulsa **Comprobar configuración de Netlify**. Si falta una variable, corrige su nombre, valor, alcance o contexto y vuelve a desplegar.
8. Ingresa con el usuario `admin` y el valor de **ADMIN_PASSWORD**. No uses `SESSION_SECRET` ni la contraseña de la demo anterior. Si el navegador autocompleta otra contraseña, bórrala y pega la correcta.
9. Si hiciste muchos intentos, espera 15 minutos antes de intentar nuevamente. No es necesario quitar la protección ni cambiar el código para entrar.

## Saber qué versión estás viendo

Si todavía aparece “Versión de prueba · Precios, fechas y contenidos de ejemplo sujetos a confirmación”, probablemente sigue publicado el archivo HTML anterior o una configuración que sirve otra carpeta. La versión corregida no muestra ningún aviso en la parte superior.

Comprueba que `netlify.toml` esté en la raíz del repositorio, que Publish directory sea `public` y que el último despliegue de esa rama haya terminado. Los cambios visuales requieren actualizar los archivos; las variables por sí solas no cambian el diseño.

## Comprobar que los cambios se comparten

1. Entra al administrador, modifica un texto o precio y pulsa Guardar cambios.
2. Espera “Cambios publicados para todos los visitantes”.
3. Abre el mismo sitio en otro navegador o celular sin iniciar sesión. Recarga y comprueba el dato.
4. El catálogo vuelve a consultarse periódicamente en las páginas visibles cuando no tienen un panel abierto. Las ediciones del catálogo no necesitan un nuevo deploy.
5. Usa Exportar copia como respaldo. Guarda primero para que se incluyan los campos recién escritos. No restablezcas el catálogo inicial ni importes otra copia si quieres conservar los contenidos actuales.

## Si el acceso sigue fallando

- **Configuración pendiente:** revisa las tres variables y que estén disponibles para Functions en Production. Haz un nuevo deploy.
- **Usuario o contraseña incorrectos:** usa ADMIN_PASSWORD del último despliegue. El generador local no cambia por sí solo la contraseña del sitio.
- **No se encontró la función de acceso:** verifica la carpeta `netlify/functions` y que publiques mediante el repositorio completo. Arrastrar solo `public` a Netlify no instala el servidor.
- **No se pudo conectar con el catálogo:** revisa los registros de las funciones `session` y `catalog` en Netlify. No borres Blobs. Comparte únicamente el mensaje de error, nunca claves ni tokens.
- **Origen no permitido:** abre el dominio principal de Netlify directamente, fuera de una vista previa insertada en otra página.
- **El aviso antiguo no desaparece:** verifica el último deploy, Publish directory y la recarga completa.

La revisión local no permite saber qué variables tiene tu cuenta. Para diagnosticar un problema que persista, comparte la dirección pública del sitio y el texto exacto del error, sin contraseñas ni capturas que muestren sus valores.

## Información técnica y límites

El catálogo se guarda en el almacén `escuela-catalogo`, clave `escuela/catalog-v1.json`. Se conservan las páginas de cursos, los videos verticales, las promociones, WhatsApp, las capacitaciones para empresas y los servicios. No se hacen cobros ni inscripciones automáticas.

El plan y los consumos dependen de tu cuenta de Netlify. No se cambia el plan ni se activan servicios de pago con estos archivos. No se incluyen claves reales. `npm ci`, `npm test` y `npm run build` permiten verificar el proyecto. Las pruebas locales usan datos aislados.

Fuentes oficiales: [variables para funciones de Netlify](https://docs.netlify.com/build/functions/environment-variables/), [despliegue de funciones desde Git](https://docs.netlify.com/build/functions/get-started/), [Netlify Blobs](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).


## Actualización: productos y nuevos cursos

Consulta `ACTUALIZAR_PRODUCTOS.html` para revisar la vista previa y actualizar el mismo repositorio de GitHub y el mismo proyecto Netlify. Productos incluye tres mini apps a Bs 50 editables, ficha propia, un video por producto y carrito hacia WhatsApp. La creación de cursos está visible al principio del panel e incluye una propuesta de Recursos Humanos con IA, sin fechas ni precio inventados. Los datos existentes y las variables administrativas no se reemplazan.
