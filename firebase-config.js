// Public Firebase Web app configuration. Never add OAuth client secrets or admin keys here.
export const firebaseConfig = {
  "apiKey": "AIzaSyDTwCqeMwM3Ru714Q_o9kZkOeP-BWd2YNw",
  "appId": "1:278826024918:web:8b179e4438d15b70be6e77",
  "authDomain": "clinicalmind-5a7f4.firebaseapp.com",
  "databaseURL": "",
  "measurementId": "G-W42S2V9ZMB",
  "messagingSenderId": "278826024918",
  "projectId": "clinicalmind-5a7f4",
  "storageBucket": "clinicalmind-5a7f4.firebasestorage.app"
};

// This domain is registered with the existing Google OAuth client.
// Other origins use a popup; redirect is reserved for this exact Hosting domain.
export function getClientFirebaseConfig() {
  return { ...firebaseConfig };
}
