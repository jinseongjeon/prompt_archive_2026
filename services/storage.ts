import { Post } from '../types';
import { db, storage } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocs 
} from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";

const POSTS_COLLECTION = 'posts';
const LOCAL_STORAGE_KEY = 'minimalist_ai_archive_fallback';

// 내부 상태: Firebase 권한 문제 발생 시 true로 전환
let isFallbackMode = false;

/**
 * LocalStorage 헬퍼 함수
 */
const getLocalPosts = (): Post[] => {
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

const saveLocalPosts = (posts: Post[]) => {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(posts));
};

/**
 * 이미지 업로드 (Firebase Storage 실패 시 Base64 그대로 유지)
 */
const uploadImageToStorage = async (postId: string, base64OrUrl: string, index: number): Promise<string> => {
  if (base64OrUrl.startsWith('http')) return base64OrUrl;
  if (isFallbackMode) return base64OrUrl; // 폴백 모드일 땐 base64 그대로 반환 (스토리지 저장 생략)

  try {
    const storageRef = ref(storage, `archives/${postId}/image_${index}_${Date.now()}`);
    const uploadData = base64OrUrl.includes('base64,') ? base64OrUrl : `data:image/jpeg;base64,${base64OrUrl}`;
    const snapshot = await uploadString(storageRef, uploadData, 'data_url');
    return await getDownloadURL(snapshot.ref);
  } catch (error: any) {
    if (error.code === 'storage/unauthorized' || error.code === 'storage/retry-limit-exceeded') {
      console.warn("Firebase Storage 권한 부족. 이미지를 로컬 모드로 처리합니다.");
      isFallbackMode = true;
      return base64OrUrl;
    }
    throw error;
  }
};

export const savePost = async (post: Post): Promise<void> => {
  try {
    if (isFallbackMode) throw new Error("Fallback mode active");

    const imageUrls = await Promise.all(
      post.images.map((img, idx) => uploadImageToStorage(post.id, img, idx))
    );

    const postWithUrls = { ...post, images: imageUrls };
    await setDoc(doc(db, POSTS_COLLECTION, post.id), postWithUrls);
  } catch (error: any) {
    // 권한 에러 (permission-denied) 발생 시 로컬 저장소로 자동 전환
    if (error.code === 'permission-denied' || error.message === "Fallback mode active") {
      console.error("Firebase Firestore 권한 오류. 로컬 저장소를 사용합니다.");
      isFallbackMode = true;
      const localPosts = getLocalPosts();
      saveLocalPosts([post, ...localPosts]);
    } else {
      throw error;
    }
  }
};

export const updatePost = async (post: Post): Promise<void> => {
  try {
    if (isFallbackMode) throw new Error("Fallback mode active");

    const imageUrls = await Promise.all(
      post.images.map((img, idx) => uploadImageToStorage(post.id, img, idx))
    );

    const postWithUrls = { ...post, images: imageUrls };
    await setDoc(doc(db, POSTS_COLLECTION, post.id), postWithUrls);
  } catch (error: any) {
    if (error.code === 'permission-denied' || error.message === "Fallback mode active") {
      isFallbackMode = true;
      const localPosts = getLocalPosts();
      const updated = localPosts.map(p => p.id === post.id ? post : p);
      saveLocalPosts(updated);
    } else {
      throw error;
    }
  }
};

export const getAllPosts = async (): Promise<Post[]> => {
  try {
    if (isFallbackMode) return getLocalPosts();

    const q = query(collection(db, POSTS_COLLECTION), orderBy("timestamp", "desc"));
    const querySnapshot = await getDocs(q);
    const fbPosts = querySnapshot.docs.map(doc => doc.data() as Post);
    
    // 로컬 데이터가 있다면 합쳐서 반환 (중복 제거)
    const localPosts = getLocalPosts();
    const combined = [...fbPosts];
    localPosts.forEach(lp => {
      if (!combined.some(fp => fp.id === lp.id)) combined.push(lp);
    });
    
    return combined.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("Firestore 접근 권한이 없습니다. 로컬 데이터를 불러옵니다.");
      isFallbackMode = true;
      return getLocalPosts();
    }
    console.error("Error fetching posts:", error);
    return getLocalPosts(); // 에러 발생 시에도 빈 배열보다는 로컬 데이터 반환
  }
};

export const deletePost = async (id: string): Promise<void> => {
  try {
    if (!isFallbackMode) {
      await deleteDoc(doc(db, POSTS_COLLECTION, id));
    }
  } catch (error: any) {
    if (error.code === 'permission-denied') isFallbackMode = true;
  } finally {
    const localPosts = getLocalPosts();
    saveLocalPosts(localPosts.filter(p => p.id !== id));
  }
};