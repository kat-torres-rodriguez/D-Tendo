# 🍄 Casa Quest — la aventura del hogar

App web familiar con estética de videojuego de bosque encantado. Se abre desde un código QR y no hay que instalar nada.

| Pestaña | Qué hace |
|---|---|
| ⚔️ **Misiones** | Los guardianes (adultos) crean tareas con XP, frecuencia (una vez, diaria o semanal) y fecha. El héroe las marca como realizadas y aparecen brillitos, sonido y medalla. El héroe también puede *pedir ayuda* a un guardián. |
| 🏆 **Tesoro** | Nivel, XP, racha 🔥, 14 medallas para desbloquear, tienda de premios canjeables con monedas 🪙 y ranking familiar. |
| 🍄 **Despensa** | Inventario con botones ➖/➕ y un **mínimo** por producto. |
| 🛒 **Súper** | Lista automática con todo lo que está bajo el mínimo, más extras manuales. En el súper se marca lo que va al carro, y al volver se **registra la compra** (+25 XP), lo que suma automáticamente a la despensa. |
| 📖 **Recetas** | 50 recetas incluidas. Filtros: *Puedo hacerla* / *Me falta poco* / *Todas*. Se pueden agregar, editar y ocultar recetas. Incluye "Agregar faltantes a la lista" y "¡La cociné!" (+30 XP). |
| 📜 **Muro** | Notas tipo post-it con reacciones, más un registro automático de logros. |
| 🧝 **Perfil** (tocar el avatar) | Avatar emoji o imagen propia, sonidos, código QR para imprimir, integrantes y PIN. |

---

## 1. Probar en el computador (opcional)

Sin configurar Firebase, la app funciona en **modo demo**: los datos quedan solo en ese navegador.

```bash
node dev-server.mjs
```
Luego abre http://localhost:5173

## 2. Crear la base de datos gratuita (Firebase)

1. Entra a https://console.firebase.google.com con tu cuenta de Google y pulsa **Crear un proyecto** (por ejemplo `casa-quest`). Puedes desactivar Google Analytics.
2. En el menú izquierdo ve a **Compilación → Realtime Database → Crear base de datos**. Elige la ubicación que quieras (por ejemplo Estados Unidos) e inicia en **modo bloqueado**.
3. En la pestaña **Reglas**, borra lo que haya, pega el contenido de [`database.rules.json`](database.rules.json) y pulsa **Publicar**.
   - Con estas reglas, solo quien tenga el enlace con la clave secreta de la familia (la que va dentro del QR) puede leer y escribir.
4. Ve a ⚙️ **Configuración del proyecto → Tus apps → `</>` (Web)**, registra la app (el nombre puede ser cualquiera y no hace falta Hosting) y copia el objeto `firebaseConfig`.
5. Pégalo en [`js/config.js`](js/config.js). Revisa que incluya `databaseURL`; si no aparece, cópiala desde la página de Realtime Database (empieza con `https://...firebaseio.com` o `...firebasedatabase.app`).

> La `apiKey` de Firebase no es secreta. Está diseñada para ir en el código público; lo que protege los datos son las reglas del paso 3.

## 3. Publicar en GitHub Pages

1. En GitHub crea un repositorio nuevo, por ejemplo `casa-quest`. En el plan gratuito de GitHub Pages el repositorio tiene que ser público.
2. Desde esta carpeta ejecuta (cambia `TU-USUARIO`):

```bash
git init
```
```bash
git add . && git commit -m "Casa Quest"
```
```bash
git branch -M main && git remote add origin https://github.com/TU-USUARIO/casa-quest.git && git push -u origin main
```

3. En el repositorio ve a **Settings → Pages → Source: Deploy from a branch → `main` / `(root)` → Save**.
4. Unos minutos después la app estará en `https://TU-USUARIO.github.io/casa-quest/`.

## 4. Primer uso y QR

1. Abre esa dirección y pulsa **Crear nueva familia**. Se genera una clave secreta en el enlace (`#k=...`).
2. Completa el formulario: nombre de la familia, tu nombre, el del héroe y un PIN de 4 dígitos.
3. Toca tu avatar → **Código QR** → **Imprimir**, y pégalo en el refrigerador 🧲.
4. Quien escanee el QR elige su personaje. La primera vez crea su **clave personal de 1 número** (no se puede repetir entre integrantes); después entra tocando ese número. Los guardianes, además, escriben el PIN.
5. Cada uno puede cambiar su nombre (no se permiten nombres repetidos) y su clave desde su avatar. Si alguien olvida su clave, un guardián la reinicia con el botón 🔢 en la lista de integrantes.

⚠️ **No compartas el enlace con la clave fuera de la familia**: quien lo tenga puede entrar.

## Personalizar

- **Recetas base**: [`js/recipes.js`](js/recipes.js). Las recetas que se agregan desde la app se guardan en Firebase.
- **Medallas, niveles y títulos**: constantes `MEDALS` y `TITLES` en [`js/app.js`](js/app.js).
- **XP por compra o cocina**: `XP_PURCHASE` y `XP_COOK` en [`js/app.js`](js/app.js).
- **Colores y estilo**: variables al inicio de [`css/style.css`](css/style.css). El fondo del bosque es un SVG dentro de [`index.html`](index.html).
