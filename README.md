# AgentChef 🍽️

Bot de Telegram para planificación de menú semanal familiar con soporte Thermomix TM6.

## ¿Qué hace?

- **Onboarding conversacional**: te hace 8 preguntas para conocer tus gustos, tiempo disponible, restricciones y lo que tenés en casa.
- **Menú semanal personalizado**: generado con IA (Gemini + OpenAI como fallback), adaptado a tu perfil.
- **Refinamiento interactivo**: modificá el menú con mensajes en lenguaje natural ("el martes no tengo tiempo", "cambiá la cena del jueves").
- **Lista de la compra**: consolidada, sin duplicados, descontando lo que ya tenés en casa.
- **Recetas completas**: con instrucciones paso a paso para Thermomix TM6 y link a Cookidoo.
- **Notificaciones diarias**: todas las mañanas te recuerda qué tenés que cocinar hoy.

## Stack técnico

| Componente | Tecnología |
|------------|-----------|
| Runtime | Node.js 18+ |
| Bot framework | Telegraf.js 4.x |
| LLM principal | Google Gemini 1.5 Flash |
| LLM fallback | OpenAI GPT-4o mini |
| Base de datos | Firebase Firestore |
| Hosting | Vercel (Serverless) |
| Cron jobs | Vercel Cron Jobs |

**Costo total mensual: $0** (todo en free tiers)

---

## Requisitos previos

- Node.js 18 o superior
- Cuenta en [Firebase](https://firebase.google.com/) (gratuita)
- Cuenta en [Vercel](https://vercel.com/) (gratuita)
- Cuenta en [Telegram](https://telegram.org/)
- API Key de [Google AI Studio](https://aistudio.google.com/) (Gemini — gratuita)
- API Key de [OpenAI](https://platform.openai.com/) (para fallback — requiere saldo mínimo)

---

## Setup paso a paso

### 1. Clonar el repositorio e instalar dependencias

```bash
git clone https://github.com/tu-usuario/agentchef.git
cd agentchef
npm install
```

### 2. Crear el bot de Telegram con BotFather

1. Abrí Telegram y buscá `@BotFather`
2. Enviá `/newbot`
3. Elegí un nombre (ej: "Mi Chef Semanal")
4. Elegí un username que termine en `bot` (ej: `michef_semanal_bot`)
5. Copiá el token que te da BotFather → lo usarás como `TELEGRAM_BOT_TOKEN`

**Configurar comandos del bot** (opcional pero recomendado):

Enviá a BotFather:
```
/setcommands
```
Seleccioná tu bot y pegá:
```
start - Iniciar o volver al inicio
menu - Ver o generar el menú de la semana
confirmar - Confirmar el menú y generar lista de compra
compra - Ver la lista de la compra
recetas - Ver todas las recetas de la semana
receta - Ver una receta específica
hoy - Ver el menú de hoy
perfil - Ver tu perfil
reset - Borrar perfil y empezar de nuevo
```

### 3. Obtener API Key de Gemini

1. Ir a [https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
2. Clic en "Create API key"
3. Seleccioná un proyecto de Google Cloud (o creá uno)
4. Copiá la API key → `GEMINI_API_KEY`

### 4. Obtener API Key de OpenAI (fallback)

1. Ir a [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Clic en "Create new secret key"
3. Copiá la key → `OPENAI_API_KEY`
4. Asegurate de tener al menos $5 de crédito en tu cuenta

### 5. Configurar Firebase

#### 5.1 Crear proyecto Firebase

1. Ir a [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Clic en "Añadir proyecto"
3. Nombre del proyecto (ej: `agentchef`)
4. Desactivar Google Analytics (no es necesario)
5. Clic en "Crear proyecto"

#### 5.2 Activar Firestore

1. En el panel de Firebase, ir a **Firestore Database**
2. Clic en "Crear base de datos"
3. Seleccionar **modo producción**
4. Elegir la ubicación más cercana a tus usuarios (ej: `europe-west1` para España/Argentina)
5. Clic en "Habilitar"

#### 5.3 Configurar reglas de seguridad de Firestore

En la pestaña **Reglas**, reemplazá las reglas por:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // Solo acceso desde el backend (Admin SDK)
    }
  }
}
```

#### 5.4 Crear Service Account (credenciales del backend)

1. Ir a **Configuración del proyecto** → pestaña **Cuentas de servicio**
2. Clic en "Generar nueva clave privada"
3. Se descarga un archivo JSON. Abrilo y copiá:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (incluir todas las líneas tal cual)

> **Importante**: El `private_key` tiene saltos de línea (`\n`). En Vercel, al pegar el valor, reemplazá los `\n` literales por el carácter real o pegalos como string con `\n` escapados — Vercel los maneja automáticamente.

### 6. Configurar variables de entorno localmente

Copiá el archivo de ejemplo:

```bash
cp .env.example .env
```

Editá `.env` con tus valores reales:

```
TELEGRAM_BOT_TOKEN=1234567890:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_API_KEY=sk-proj-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_PROJECT_ID=agentchef-xxxxx
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@agentchef-xxxxx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
NOTIFICATION_HOUR=9
```

### 7. Primer deploy en Vercel

#### 7.1 Instalar Vercel CLI

```bash
npm install -g vercel
```

#### 7.2 Hacer login en Vercel

```bash
vercel login
```

#### 7.3 Desplegar

```bash
vercel --prod
```

Seguí las instrucciones:
- ¿Es tu proyecto existente? → No
- Directorio del proyecto → `.` (actual)
- Framework → Other
- Build command → (dejar vacío)
- Output directory → (dejar vacío)

Al finalizar, Vercel te da la URL del proyecto (ej: `https://agentchef-xxxx.vercel.app`).

#### 7.4 Configurar variables de entorno en Vercel

Desde el dashboard de Vercel → tu proyecto → **Settings** → **Environment Variables**, agregá todas las variables del `.env`:

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (pegar el valor completo incluyendo `-----BEGIN PRIVATE KEY-----`)
- `NOTIFICATION_HOUR` = `9`
- `CRON_SECRET` = (una cadena aleatoria que usarás para proteger el endpoint del cron)

> **Tip**: Para el `FIREBASE_PRIVATE_KEY`, Vercel permite pegar el valor multilínea directamente en la UI. No necesitás escapar los `\n`.

Después de agregar las variables, redesplegá:

```bash
vercel --prod
```

### 8. Configurar el webhook de Telegram

Una vez que el bot esté desplegado en Vercel, registrá el webhook. Ejecutá en tu navegador o con curl:

```bash
curl "https://api.telegram.org/bot{TU_TOKEN}/setWebhook?url=https://{TU_DOMINIO_VERCEL}.vercel.app/api/webhook"
```

Reemplazando `{TU_TOKEN}` y `{TU_DOMINIO_VERCEL}` con tus valores reales.

**Verificar que el webhook está configurado:**

```bash
curl "https://api.telegram.org/bot{TU_TOKEN}/getWebhookInfo"
```

Deberías ver:
```json
{
  "ok": true,
  "result": {
    "url": "https://agentchef-xxxx.vercel.app/api/webhook",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    ...
  }
}
```

### 9. Verificar que el cron está funcionando

En el dashboard de Vercel → tu proyecto → **Cron Jobs**, deberías ver el job configurado para las `0 7 * * *` (7:00 UTC = 9:00 Madrid en verano).

Para probar manualmente el endpoint del cron:

```bash
curl -X GET "https://{TU_DOMINIO}.vercel.app/api/cron" \
  -H "Authorization: Bearer {TU_CRON_SECRET}"
```

---

## Comandos del bot

| Comando | Descripción |
|---------|-------------|
| `/start` | Inicia el onboarding si es la primera vez, o muestra el resumen si ya tenés perfil |
| `/menu` | Muestra el menú de la semana actual o genera uno nuevo |
| `/confirmar` | Confirma el menú en borrador y genera la lista de la compra |
| `/compra` | Muestra la lista de la compra de la semana |
| `/recetas` | Lista todos los platos con botones para ver la receta completa |
| `/receta [plato]` | Muestra la receta de un plato específico (ej: `/receta pasta al pesto`) |
| `/hoy` | Muestra el menú del día + recordatorio de ingredientes |
| `/perfil` | Muestra tus preferencias actuales |
| `/reset` | Borra tu perfil y menú para empezar de nuevo |

## Flujo de uso típico

1. `/start` → completar 8 preguntas del onboarding
2. El bot genera el menú semanal automáticamente
3. Refinar el menú con mensajes naturales ("el martes no tengo tiempo")
4. Escribir `confirmar` → se genera la lista de la compra
5. `/recetas` → ver recetas completas con instrucciones Thermomix
6. Cada mañana: notificación automática con el menú del día

---

## Estructura del proyecto

```
/api
  webhook.js      → Recibe updates de Telegram (webhook Vercel)
  cron.js         → Envía notificaciones diarias (Vercel Cron 7:00 UTC)
/src
  /bot
    /handlers
      commands.js   → Implementación de todos los comandos
      menu.js       → Generación y refinamiento del menú
      shopping.js   → Lista de la compra
      recipes.js    → Recetas individuales y listado
    /scenes
      onboardingScene.js  → WizardScene de 8 pasos
  /services
    firebase.js     → CRUD en Firestore
    gemini.js       → LLM principal (Gemini 1.5 Flash)
    openai.js       → LLM fallback (GPT-4o mini)
    llm.js          → Orquestador con fallback automático
    scheduler.js    → Envío de mensajes Telegram desde el cron
  /utils
    thermomix.js    → Formateador de recetas estilo TM6
    parser.js       → Parser y validador de JSON del LLM
    dateHelper.js   → Helpers de fechas (zona Europe/Madrid)
vercel.json
.env.example
```

---

## Troubleshooting

### El bot no responde

1. Verificar que el webhook está configurado: `getWebhookInfo`
2. Revisar los logs en Vercel Dashboard → Functions → `webhook`
3. Verificar que las variables de entorno están configuradas en Vercel

### Error "Firebase not initialized"

- Verificar que `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` y `FIREBASE_PRIVATE_KEY` están correctas
- En `FIREBASE_PRIVATE_KEY`, asegurarse de que el valor incluye los `-----BEGIN/END PRIVATE KEY-----`

### El LLM no genera JSON válido

- El bot tiene reintentos automáticos y fallback a OpenAI
- Si persiste, revisar los logs para ver la respuesta cruda del LLM
- Verificar que `GEMINI_API_KEY` y `OPENAI_API_KEY` son válidas

### El cron no envía notificaciones

1. Verificar que el Cron Job aparece en el dashboard de Vercel
2. Verificar que `CRON_SECRET` está configurada en las variables de entorno
3. Probar el endpoint manualmente con el header de autorización
4. Revisar logs de la función `cron` en Vercel

---

## Notas sobre Cookidoo

Cookidoo no tiene API pública. El bot genera recetas en formato Thermomix TM6 nativo usando el LLM, e incluye al final de cada receta un link de búsqueda directo:

```
https://cookidoo.es/search?query=NOMBRE_DEL_PLATO
```

Si encontrás la receta en Cookidoo, la versión oficial puede tener pasos más optimizados para tu modelo específico de Thermomix.

---

## Licencia

MIT
