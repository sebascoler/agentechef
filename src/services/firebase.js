const admin = require('firebase-admin');

let db;

function inicializarFirebase() {
  if (admin.apps.length) return admin.app();

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  const app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });

  db = admin.firestore();
  return app;
}

function obtenerDB() {
  if (!db) {
    inicializarFirebase();
    db = admin.firestore();
  }
  return db;
}

// --- Usuarios ---

async function obtenerUsuario(chatId) {
  try {
    const doc = await obtenerDB().collection('users').doc(String(chatId)).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('[Firebase] Error obteniendo usuario:', error.message);
    throw error;
  }
}

async function guardarUsuario(chatId, datos) {
  try {
    const ref = obtenerDB().collection('users').doc(String(chatId));
    const ahora = admin.firestore.FieldValue.serverTimestamp();
    await ref.set(
      { ...datos, chat_id: String(chatId), updated_at: ahora },
      { merge: true }
    );
  } catch (error) {
    console.error('[Firebase] Error guardando usuario:', error.message);
    throw error;
  }
}

async function crearUsuario(chatId, datosIniciales) {
  try {
    const ref = obtenerDB().collection('users').doc(String(chatId));
    const ahora = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({
      ...datosIniciales,
      chat_id: String(chatId),
      onboarding_completo: false,
      created_at: ahora,
      updated_at: ahora,
    });
  } catch (error) {
    console.error('[Firebase] Error creando usuario:', error.message);
    throw error;
  }
}

async function eliminarUsuario(chatId) {
  try {
    const db = obtenerDB();
    const ref = db.collection('users').doc(String(chatId));

    // Eliminar subcolecciones
    const menus = await ref.collection('menus').listDocuments();
    for (const menu of menus) {
      await menu.delete();
    }

    const recetas = await ref.collection('recetas').listDocuments();
    for (const receta of recetas) {
      await receta.delete();
    }

    await ref.delete();
  } catch (error) {
    console.error('[Firebase] Error eliminando usuario:', error.message);
    throw error;
  }
}

async function obtenerTodosLosUsuarios() {
  try {
    const snapshot = await obtenerDB()
      .collection('users')
      .where('onboarding_completo', '==', true)
      .get();
    return snapshot.docs.map((doc) => doc.data());
  } catch (error) {
    console.error('[Firebase] Error obteniendo todos los usuarios:', error.message);
    throw error;
  }
}

// --- Menús ---

async function obtenerMenu(chatId, semanaIso) {
  try {
    const doc = await obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('menus')
      .doc(semanaIso)
      .get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('[Firebase] Error obteniendo menú:', error.message);
    throw error;
  }
}

async function guardarMenu(chatId, semanaIso, datos) {
  try {
    const ref = obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('menus')
      .doc(semanaIso);
    const ahora = admin.firestore.FieldValue.serverTimestamp();
    await ref.set({ ...datos, semana: semanaIso, created_at: ahora }, { merge: true });
  } catch (error) {
    console.error('[Firebase] Error guardando menú:', error.message);
    throw error;
  }
}

async function actualizarMenu(chatId, semanaIso, datos) {
  try {
    const ref = obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('menus')
      .doc(semanaIso);
    await ref.update(datos);
  } catch (error) {
    console.error('[Firebase] Error actualizando menú:', error.message);
    throw error;
  }
}

// --- Recetas ---

async function obtenerReceta(chatId, recetaId) {
  try {
    const doc = await obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('recetas')
      .doc(recetaId)
      .get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('[Firebase] Error obteniendo receta:', error.message);
    throw error;
  }
}

async function guardarReceta(chatId, recetaId, datos) {
  try {
    const ref = obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('recetas')
      .doc(recetaId);
    await ref.set(datos, { merge: true });
  } catch (error) {
    console.error('[Firebase] Error guardando receta:', error.message);
    throw error;
  }
}

async function listarRecetas(chatId) {
  try {
    const snapshot = await obtenerDB()
      .collection('users')
      .doc(String(chatId))
      .collection('recetas')
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('[Firebase] Error listando recetas:', error.message);
    throw error;
  }
}

module.exports = {
  inicializarFirebase,
  obtenerUsuario,
  guardarUsuario,
  crearUsuario,
  eliminarUsuario,
  obtenerTodosLosUsuarios,
  obtenerMenu,
  guardarMenu,
  actualizarMenu,
  obtenerReceta,
  guardarReceta,
  listarRecetas,
};
