import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  getDoc,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { GroceryList, GroceryItem, ListInvitation } from '../types/firebase'

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

  const q = query(collection(db, 'lists'), where('members', 'array-contains', auth.currentUser.uid))

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as GroceryList[]
}

export const getListItems = async (listId: string) => {
  const q = query(collection(db, 'items'), where('listId', '==', listId))

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as GroceryItem[]
}

export const toggleItemComplete = async (itemId: string, completed: boolean) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const itemRef = doc(db, 'items', itemId)
  await updateDoc(itemRef, {
    completed,
    completedBy: completed ? auth.currentUser.uid : null,
    completedAt: completed ? new Date() : null,
  })
}

export const deleteItem = async (itemId: string) => {
  await deleteDoc(doc(db, 'items', itemId))
}

export const addMemberToList = async (listId: string, memberEmail: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Check if user is owner
  const listRef = doc(db, 'lists', listId)
  const listDoc = await getDoc(listRef)
  const list = listDoc.data() as GroceryList

  if (list.createdBy !== auth.currentUser.uid) {
    throw new Error('Only list owners can add members')
  }

  // Find user by email
  const userQuery = query(collection(db, 'users'), where('email', '==', memberEmail))

  const userSnapshot = await getDocs(userQuery)
  if (userSnapshot.empty) throw new Error('User not found')

  const userId = userSnapshot.docs[0].id
  if (list.members.includes(userId)) throw new Error('User is already a member')

  // Add member
  await updateDoc(listRef, {
    members: arrayUnion(userId),
  })
}

export const removeMemberFromList = async (listId: string, userId: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Check if user is owner
  const listRef = doc(db, 'lists', listId)
  const listDoc = await getDoc(listRef)
  const list = listDoc.data() as GroceryList

  if (list.createdBy !== auth.currentUser.uid) {
    throw new Error('Only list owners can remove members')
  }

  if (userId === list.createdBy) {
    throw new Error('Cannot remove list owner')
  }

  // Remove member
  await updateDoc(listRef, {
    members: arrayRemove(userId),
  })
}

export const getList = async (listId: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const listRef = doc(db, 'lists', listId)
  const listDoc = await getDoc(listRef)

  if (!listDoc.exists()) throw new Error('List not found')

  const list = { id: listDoc.id, ...listDoc.data() } as GroceryList

  // Check if user has access
  if (!list.members.includes(auth.currentUser.uid)) {
    throw new Error('Access denied')
  }

  return list
}

export const deleteList = async (listId: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Check if user is owner
  const listRef = doc(db, 'lists', listId)
  const listDoc = await getDoc(listRef)

  if (!listDoc.exists()) throw new Error('List not found')

  const list = listDoc.data() as GroceryList
  if (list.createdBy !== auth.currentUser.uid) {
    throw new Error('Only list owners can delete lists')
  }

  // Get all items in the list
  const itemsQuery = query(collection(db, 'items'), where('listId', '==', listId))
  const itemsSnapshot = await getDocs(itemsQuery)

  // Use a batch to delete the list and all its items
  const batch = writeBatch(db)

  // Delete all items
  itemsSnapshot.docs.forEach(itemDoc => {
    batch.delete(doc(db, 'items', itemDoc.id))
  })

  // Delete the list
  batch.delete(listRef)

  // Commit the batch
  await batch.commit()
}

export const inviteUserToList = async (listId: string, email: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Check if user is owner
  const listRef = doc(db, 'lists', listId)
  const listDoc = await getDoc(listRef)
  const list = listDoc.data() as GroceryList

  if (list.createdBy !== auth.currentUser.uid) {
    throw new Error('Only list owners can invite members')
  }

  // Check if invitation already exists
  const existingInviteQuery = query(
    collection(db, 'invitations'),
    where('listId', '==', listId),
    where('invitedEmail', '==', email),
    where('status', '==', 'pending')
  )
  const existingInvites = await getDocs(existingInviteQuery)
  if (!existingInvites.empty) {
    throw new Error('An invitation is already pending for this email')
  }

  // Create invitation
  const invitation: Omit<ListInvitation, 'id'> = {
    listId,
    listName: list.name,
    invitedEmail: email,
    invitedBy: auth.currentUser.uid,
    invitedByEmail: auth.currentUser.email || '',
    status: 'pending',
    createdAt: new Date(),
  }

  await addDoc(collection(db, 'invitations'), invitation)
}

export const getPendingInvitations = async () => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const q = query(
    collection(db, 'invitations'),
    where('invitedEmail', '==', auth.currentUser.email),
    where('status', '==', 'pending')
  )

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ListInvitation[]
}

export const getSentInvitations = async (listId: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const q = query(
    collection(db, 'invitations'),
    where('listId', '==', listId),
    where('invitedBy', '==', auth.currentUser.uid)
  )

  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as ListInvitation[]
}

export const respondToInvitation = async (invitationId: string, accept: boolean) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  const invitationRef = doc(db, 'invitations', invitationId)
  const invitationDoc = await getDoc(invitationRef)

  if (!invitationDoc.exists()) {
    throw new Error('Invitation not found')
  }

  const invitation = invitationDoc.data() as ListInvitation
  if (invitation.invitedEmail !== auth.currentUser.email) {
    throw new Error('This invitation is not for you')
  }

  if (invitation.status !== 'pending') {
    throw new Error('This invitation has already been responded to')
  }

  const batch = writeBatch(db)

  // Update invitation status
  batch.update(invitationRef, {
    status: accept ? 'accepted' : 'declined',
    respondedAt: new Date(),
  })

  if (accept) {
    // Add user to list members
    const listRef = doc(db, 'lists', invitation.listId)
    batch.update(listRef, {
      members: arrayUnion(auth.currentUser.uid),
    })
  }

  await batch.commit()
}
