export interface GroceryList {
  id: string
  name: string
  createdBy: string
  createdAt: Date
  members: string[] // array of user IDs who have access to this list
}

export interface GroceryItem {
  id: string
  listId: string
  name: string
  quantity: number
  completed: boolean
  createdBy: string
  createdAt: Date
  completedBy?: string
  completedAt?: Date
}

export interface User {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
}

export interface ListInvitation {
  id: string
  listId: string
  listName: string
  invitedEmail: string
  invitedBy: string
  invitedByEmail: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: Date
  respondedAt?: Date
}
