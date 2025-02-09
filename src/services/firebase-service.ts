import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  arrayUnion,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { GroceryList, GroceryItem } from '../types/firebase'

export const createList = async (name: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const newList: Omit<GroceryList, 'id'> = {
    name,
    createdBy: auth.currentUser.uid,
    createdAt: new Date(),
    members: [auth.currentUser.uid],
  }

  const docRef = await addDoc(collection(db, 'lists'), newList)
  return docRef.id
}

export const addItemToList = async (listId: string, itemName: string, quantity: number = 1) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const newItem: Omit<GroceryItem, 'id'> = {
    listId,
    name: itemName,
    quantity,
    completed: false,
    createdBy: auth.currentUser.uid,
    createdAt: new Date(),
  }

  const docRef = await addDoc(collection(db, 'items'), newItem)
  return docRef.id
}

export const getUserLists = async () => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const q = query(
    collection(db, 'lists'),
    where('members', 'array-contains', auth.currentUser.uid)
  )

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as GroceryList[]
}

export const getListItems = async (listId: string) => {
  const q = query(
    collection(db, 'items'),
    where('listId', '==', listId)
  )

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as GroceryItem[]
}

export const toggleItemComplete = async (itemId: string, completed: boolean) => {
  const itemRef = doc(db, 'items', itemId)
  await updateDoc(itemRef, { completed })
}

export const deleteItem = async (itemId: string) => {
  await deleteDoc(doc(db, 'items', itemId))
}

export const addMemberToList = async (listId: string, memberEmail: string) => {
  // You'll need to implement user lookup by email first
  // This is a simplified version
  const userQuery = query(
    collection(db, 'users'),
    where('email', '==', memberEmail)
  )

  const userSnapshot = await getDocs(userQuery)
  if (userSnapshot.empty) throw new Error('User not found')

  const userId = userSnapshot.docs[0].id
  const listRef = doc(db, 'lists', listId)

  await updateDoc(listRef, {
    members: arrayUnion(userId)
  })
}
