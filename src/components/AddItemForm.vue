<script setup lang="ts">
import { ref } from 'vue'
import ItemSuggestions from '@/components/ItemSuggestions.vue'

const props = defineProps<{
    listId: string
}>()

const emit = defineEmits<{
    (e: 'addItem', itemName: string, quantity: number, options: {
        unit?: string,
        category?: string,
        storeAisle?: number,
        estimatedPrice?: number,
        note?: string
    }): void
    (e: 'suggestionSelect', suggestion: string): void
}>()

const newItemName = ref('')
const newItemQuantity = ref(1)
const newItemUnit = ref('')
const newItemCategory = ref('')
const newItemAisle = ref<number | null>(null)
const newItemPrice = ref<number | null>(null)
const newItemNote = ref('')

const handleAddItem = () => {
    const itemName = newItemName.value.trim()
    if (!itemName) return

    // Store input values in local variables
    const quantity = newItemQuantity.value
    const unit = newItemUnit.value
    const category = newItemCategory.value
    const aisle = newItemAisle.value
    const price = newItemPrice.value
    const note = newItemNote.value

    // Clear form immediately
    newItemName.value = ''
    newItemQuantity.value = 1
    newItemUnit.value = ''
    newItemCategory.value = ''
    newItemAisle.value = null
    newItemPrice.value = null
    newItemNote.value = ''

    // Emit the event with all the item data
    emit('addItem', itemName, quantity, {
        unit,
        category,
        storeAisle: aisle || undefined,
        estimatedPrice: price || undefined,
        note: note || undefined
    })
}

const handleSuggestionSelect = (suggestion: string) => {
    newItemName.value = suggestion
    emit('suggestionSelect', suggestion)
    handleAddItem()
}
</script>

<template>
    <div class="bg-white shadow-sm rounded-lg p-4 mb-6">
        <form @submit.prevent="handleAddItem()" class="flex flex-col gap-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div class="col-span-1 sm:col-span-2">
                    <label for="itemName" class="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                    <input id="itemName" v-model="newItemName" type="text" required placeholder="Add new item"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
                </div>
                <div>
                    <label for="quantity" class="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                    <input id="quantity" v-model.number="newItemQuantity" type="number" min="1" required
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
                </div>
                <div>
                    <label for="unit" class="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select id="unit" v-model="newItemUnit"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500">
                        <option value="">items</option>
                        <option value="kg">kg</option>
                        <option value="g">g</option>
                        <option value="lbs">lbs</option>
                        <option value="oz">oz</option>
                        <option value="l">liters</option>
                        <option value="ml">ml</option>
                        <option value="pkg">package</option>
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                    <label for="category" class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select id="category" v-model="newItemCategory"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500">
                        <option value="">None</option>
                        <option value="Produce">Produce</option>
                        <option value="Dairy">Dairy</option>
                        <option value="Meat">Meat</option>
                        <option value="Bakery">Bakery</option>
                        <option value="Frozen">Frozen</option>
                        <option value="Pantry">Pantry</option>
                        <option value="Beverages">Beverages</option>
                        <option value="Household">Household</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div>
                    <label for="aisle" class="block text-sm font-medium text-gray-700 mb-1">Aisle Number</label>
                    <input id="aisle" v-model.number="newItemAisle" type="number" min="0"
                        class="block w-full rounded-md border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500" />
                </div>
                <div>
                    <label for="price" class="block text-sm font-medium text-gray-700 mb-1">Estimated Price</label>
                    <div class="mt-1 relative rounded-md shadow-sm">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span class="text-gray-500 sm:text-sm">$</span>
                        </div>
                        <input type="number" id="price" v-model.number="newItemPrice" min="0" step="0.01"
                            class="focus:ring-pink-500 focus:border-pink-500 block w-full pl-7 pr-12 sm:text-sm border-gray-300 rounded-md"
                            placeholder="0.00" />
                    </div>
                </div>
            </div>

            <!-- Notes Field -->
            <div>
                <label for="note" class="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea id="note" v-model="newItemNote" rows="2"
                    placeholder="Add any special instructions or notes..."
                    class="shadow-sm focus:ring-pink-500 focus:border-pink-500 block w-full sm:text-sm border-gray-300 rounded-md"></textarea>
            </div>

            <div class="flex justify-end">
                <button type="submit"
                    class="bg-pink-600 text-white px-4 py-2 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 flex items-center justify-center gap-2">
                    <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Add to List
                </button>
            </div>
        </form>

        <!-- Add ItemSuggestions component -->
        <ItemSuggestions :list-id="listId" @select="handleSuggestionSelect" />
    </div>
</template>
