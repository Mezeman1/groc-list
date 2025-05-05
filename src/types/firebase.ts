export interface GroceryList {
  id: string
  name: string
  createdBy: string
  createdAt: Date
  members: string[] // array of user IDs who have access to this list
  categories?: string[] // Custom categories for this list
  dueDate?: Date // Optional due date for the shopping trip
  repeatSchedule?: 'daily' | 'weekly' | 'biweekly' | 'monthly' // Optional schedule for recurring lists
  storeId?: string // Reference to preferred store for this list
  budget?: number // Optional budget for this shopping list
  actualCost?: number // Actual spent amount
}

export interface GroceryItem {
  id: string
  listId: string
  name: string
  quantity: number
  unit?: string // e.g., 'kg', 'lbs', 'oz', 'items', etc.
  completed: boolean
  createdBy: string
  createdAt: Date
  completedBy?: string
  completedAt?: Date
  order: number
  category?: string // e.g., 'Produce', 'Dairy', 'Meat', 'Bakery', etc.
  storeAisle?: number // Store aisle number to help users locate items
  estimatedPrice?: number // Estimated price per unit
  actualPrice?: number // Actual price paid per unit
  note?: string // Additional notes about the item (e.g., "Get the organic one")
  favorite?: boolean // Whether this is a favorite/frequently purchased item
  brand?: string // Preferred brand
  pictureUrl?: string // Optional image of the item
}

export interface ItemCorrelation {
  id: string
  itemName: string
  correlatedItemName: string
  frequency: number
  lastUpdated: Date
  userId: string
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

export interface Store {
  id: string
  name: string
  userId: string
  createdAt: Date
  categories: StoreCategory[]
}

export interface StoreCategory {
  id: string
  name: string
  aisleNumber?: number
  order: number
}

export interface ShoppingTrip {
  id: string
  listId: string
  userId: string
  storeId?: string
  startTime: Date
  endTime?: Date
  totalCost: number
  itemCount: number
  notes?: string
}

export interface ShoppingAnalytics {
  userId: string
  monthlySpending: {
    [month: string]: number // Format: 'YYYY-MM'
  }
  categorySpending: {
    [category: string]: number
  }
  frequentItems: {
    [itemName: string]: number
  }
  lastUpdated: Date
}
