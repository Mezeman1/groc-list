import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  doc,
  increment,
  getDoc,
} from 'firebase/firestore'
import { db, auth } from '../firebase'
import type { ItemCorrelation, GroceryItem } from '../types/firebase'

// Update correlations when a new item is added
export const updateItemCorrelations = async (newItemName: string, listId: string) => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Get existing items in the list
  const itemsQuery = query(collection(db, 'items'), where('listId', '==', listId), where('completed', '==', false))
  const items = (await getDocs(itemsQuery)).docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as GroceryItem[]

  // Update correlations for each existing item
  for (const item of items) {
    if (item.name === newItemName) continue

    // Check if correlation already exists
    const correlationQuery = query(
      collection(db, 'itemCorrelations'),
      where('userId', '==', auth.currentUser.uid),
      where('itemName', '==', item.name),
      where('correlatedItemName', '==', newItemName)
    )
    const correlationDocs = await getDocs(correlationQuery)

    if (correlationDocs.empty) {
      // Create new correlation
      await addDoc(collection(db, 'itemCorrelations'), {
        itemName: item.name,
        correlatedItemName: newItemName,
        frequency: 1,
        lastUpdated: new Date(),
        userId: auth.currentUser.uid,
      })

      // Create reverse correlation
      await addDoc(collection(db, 'itemCorrelations'), {
        itemName: newItemName,
        correlatedItemName: item.name,
        frequency: 1,
        lastUpdated: new Date(),
        userId: auth.currentUser.uid,
      })
    } else {
      // Update existing correlation
      const correlationDoc = correlationDocs.docs[0]
      await updateDoc(doc(db, 'itemCorrelations', correlationDoc.id), {
        frequency: increment(1),
        lastUpdated: new Date(),
      })

      // Update reverse correlation
      const reverseCorrelationQuery = query(
        collection(db, 'itemCorrelations'),
        where('userId', '==', auth.currentUser.uid),
        where('itemName', '==', newItemName),
        where('correlatedItemName', '==', item.name)
      )
      const reverseCorrelationDocs = await getDocs(reverseCorrelationQuery)
      if (!reverseCorrelationDocs.empty) {
        await updateDoc(doc(db, 'itemCorrelations', reverseCorrelationDocs.docs[0].id), {
          frequency: increment(1),
          lastUpdated: new Date(),
        })
      }
    }
  }
}

// Get suggestions based on current items in the list
export const getSuggestions = async (listId: string, limit: number = 5): Promise<string[]> => {
  if (!auth.currentUser) throw new Error('User not authenticated')

  // Get current items in the list
  const itemsQuery = query(collection(db, 'items'), where('listId', '==', listId), where('completed', '==', false))
  const items = (await getDocs(itemsQuery)).docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as GroceryItem[]

  if (items.length === 0) return []

  // Get correlations for all current items
  const correlations: { [key: string]: number } = {}

  for (const item of items) {
    const correlationQuery = query(
      collection(db, 'itemCorrelations'),
      where('userId', '==', auth.currentUser.uid),
      where('itemName', '==', item.name)
    )
    const correlationDocs = await getDocs(correlationQuery)

    correlationDocs.forEach(doc => {
      const correlation = doc.data() as ItemCorrelation
      if (!items.some(item => item.name === correlation.correlatedItemName)) {
        correlations[correlation.correlatedItemName] =
          (correlations[correlation.correlatedItemName] || 0) + correlation.frequency
      }
    })
  }

  // Sort suggestions by frequency and return top N
  return Object.entries(correlations)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([itemName]) => itemName)
}
