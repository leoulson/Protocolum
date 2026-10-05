import { db } from './auth-google.js';
import { collection, query, where, getDocs, setDoc, doc, addDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

// Sync PubMed Appraisals
export async function syncPubMedAppraisals(uid) {
  if (!db) return;
  try {
    const q = query(collection(db, "pubmed_appraisals"), where("userId", "==", uid));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      localStorage.setItem(`clinicalmind.pubmed-review.v1.${data.pmid}`, JSON.stringify(data));
    });
    if (document.querySelector('.nav-btn.active')?.dataset.section === 'Laboratório PubMed') window.renderPubMedLab?.();
  } catch(e) {
    console.error("Erro ao sincronizar PubMed: ", e);
  }
}

window.savePubMedToCloud = async (pmid, reviewData) => {
   if (!window.clinicalMindUser) throw new Error("Login necessário");
   if (!db) throw new Error("Firebase não configurado");
   await setDoc(doc(db, "pubmed_appraisals", `${window.clinicalMindUser.uid}_${pmid}`), {
       ...reviewData,
       userId: window.clinicalMindUser.uid,
       timestamp: serverTimestamp()
   });
};

window.saveForumPostToCloud = async (post) => {
   if (!window.clinicalMindUser) throw new Error("Login necessário");
   if (!db) throw new Error("Firebase não configurado");
   await setDoc(doc(db, "forum_posts", post.id), {
       ...post,
       userId: window.clinicalMindUser.uid,
       timestamp: serverTimestamp()
   });
};

export async function syncForumPosts() {
  if (!db) return;
  try {
    const q = query(collection(db, "forum_posts"));
    return onSnapshot(q, (snapshot) => {
      let posts = [];
      try {
         posts = JSON.parse(localStorage.getItem('clinicalmind.community.case-posts.v1') || '[]');
      } catch(e) {}
      
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (!posts.find(p => p.id === data.id)) {
           posts.unshift(data);
        }
      });
      localStorage.setItem('clinicalmind.community.case-posts.v1', JSON.stringify(posts));
      if (document.querySelector('.nav-btn.active')?.dataset.section === 'Comunidade') window.renderLegacyCommunity?.();
    }, error => console.warn('Protocolum: forum synchronization unavailable:', error.code || 'unknown'));
  } catch(e) {
    console.error("Erro ao sincronizar fórum: ", e);
  }
}
