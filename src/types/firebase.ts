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
