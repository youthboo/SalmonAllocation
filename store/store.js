import { configureStore, createSlice } from '@reduxjs/toolkit';

// Mock data generator
const generateMockOrder = (id) => ({
  id: `ORDER-${String(id).padStart(3, '0')}`,
  status: Math.random() > 0.7 ? 'NEW' : Math.random() > 0.5 ? 'OVER_DUE' : 'EMERGENCY',
  priority: Math.random() > 0.8 ? 'HIGH' : 'NORMAL',
  customer: {
    id: `CUST-${Math.floor(Math.random() * 50)}`,
    name: 'Balerion',
    creditRemaining: 3000.00,
    creditLimit: 3000.00
  },
  product: {
    id: 'SALMON-001',
    name: 'Salmon',
    remark: '1 day delivery Product'
  },
  pricePerUnit: Math.random() > 0.5 ? 750.00 : 515.75,
  requestedQty: Math.floor(Math.random() * 15) + 5,
  allocatedQty: 0,
  createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
});

const initialState = {
  versionKey: 'v1.0.0',
  totalStock: 100,
  remainingStock: 100,
  orders: [],
  isLoading: false,
  hasMoreData: true,
  currentPage: 0,
  pageSize: 10, 
  totalOrdersGenerated: 0,
  maxOrders: 100
};

const getPriorityScore = (order) => {
  let score = 0;

  switch (order.status) {
    case 'EMERGENCY': score += 100; break;
    case 'OVER_DUE': score += 50; break;
    case 'NEW': score += 25; break;
    default: score += 0;
  }

  if (order.priority === 'HIGH') score += 25;

  const ageInDays = (Date.now() - order.createdAt) / (24 * 60 * 60 * 1000);
  score += Math.min(ageInDays * 2, 20);

  return score;
};

// Main slice
const allocationSlice = createSlice({
  name: 'allocation',
  initialState,
  reducers: {
    setVersionKey: (state, action) => {
      if (state.versionKey !== action.payload) {
        return {
          ...initialState,
          versionKey: action.payload
        };
      }
    },

    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },

    // ปรับปรุง loadMoreOrders
    loadMoreOrders: (state, action) => {
      if (state.isLoading || !state.hasMoreData) return;

      state.isLoading = true;

      // จำนวนออเดอร์ที่จะโหลดในแต่ละครั้งคือ pageSize (10) เสมอ
      const ordersToGenerate = Math.min(state.pageSize, state.maxOrders - state.totalOrdersGenerated);

      if (ordersToGenerate <= 0) {
        state.hasMoreData = false;
        state.isLoading = false;
        return;
      }

      const startId = state.totalOrdersGenerated + 1;
      const newOrders = Array.from({ length: ordersToGenerate }, (_, i) =>
        generateMockOrder(startId + i)
      ).sort((a, b) => a.createdAt - b.createdAt); // เรียงตามเวลาเก่าสุดก่อน

      state.orders.push(...newOrders);
      state.totalOrdersGenerated += ordersToGenerate; // อัปเดตจำนวนออเดอร์ที่ถูกสร้าง
      state.currentPage += 1;
      state.isLoading = false;

      if (state.totalOrdersGenerated >= state.maxOrders) {
        state.hasMoreData = false;
      }
    },

    allocateToOrder: (state, action) => {
      const { orderId, quantity } = action.payload;
      const order = state.orders.find(o => o.id === orderId);

      if (!order) {
        throw new Error('Order not found.');
      }

      const currentAllocation = order.allocatedQty;
      const requestedAllocation = Math.max(0, Math.min(quantity, order.requestedQty));

      const stockNeeded = requestedAllocation - currentAllocation;
      if (stockNeeded > state.remainingStock) {
        throw new Error('Not enough stock remaining.');
      }

      const currentCost = currentAllocation * order.pricePerUnit;
      const newCost = requestedAllocation * order.pricePerUnit;
      const costDifference = newCost - currentCost;

      if (costDifference > 0 && costDifference > order.customer.creditRemaining) {
        throw new Error('Exceeds customer credit limit.');
      }

      order.allocatedQty = requestedAllocation;
      state.remainingStock -= stockNeeded;
      order.customer.creditRemaining -= costDifference;
    },

    autoAllocate: (state) => {
      // Reset ก่อน auto-allocate
      state.orders.forEach(order => {
        const customer = state.orders.find(o => o.customer.id === order.customer.id).customer;
        order.customer.creditRemaining = customer.creditLimit;
        order.allocatedQty = 0;
      });
      state.remainingStock = state.totalStock;

      const sortedOrders = [...state.orders].sort((a, b) => {
        const priorityDiff = getPriorityScore(b) - getPriorityScore(a);
        if (priorityDiff !== 0) return priorityDiff;
        return a.createdAt - b.createdAt;
      });

      const customerAllocatedInFirstPass = new Set();

      // First Pass: พยายามจัดสรรอย่างน้อย 1 หน่วย (หรือตามที่กำหนด) ให้กับลูกค้าทุกคนก่อน
      for (const order of sortedOrders) {
        if (state.remainingStock <= 0) break;

        if (!customerAllocatedInFirstPass.has(order.customer.id)) {
          const orderInState = state.orders.find(o => o.id === order.id);
          const minUnitsToAllocate = 1; 
          const customerRef = orderInState.customer; 
          const canAllocate = Math.min(
            minUnitsToAllocate,
            state.remainingStock,
            orderInState.requestedQty,
            Math.floor(customerRef.creditRemaining / orderInState.pricePerUnit)
          );

          if (canAllocate > 0) {
            orderInState.allocatedQty += canAllocate;
            customerRef.creditRemaining -= (canAllocate * orderInState.pricePerUnit);
            state.remainingStock -= canAllocate;
            customerAllocatedInFirstPass.add(order.customer.id);
          }
        }
      }

      // Second Pass: จัดสรรที่เหลือตามลำดับความสำคัญ
      for (const order of sortedOrders) {
        if (state.remainingStock <= 0) break;

        const orderInState = state.orders.find(o => o.id === order.id);
        const currentAllocation = orderInState.allocatedQty;
        const remainingRequest = order.requestedQty - currentAllocation;
        const customerRef = orderInState.customer;

        if (remainingRequest <= 0) continue;

        const maxAdditionalAllocation = Math.min(
          remainingRequest,
          state.remainingStock,
          Math.floor(customerRef.creditRemaining / orderInState.pricePerUnit)
        );

        if (maxAdditionalAllocation > 0) {
          orderInState.allocatedQty += maxAdditionalAllocation;
          customerRef.creditRemaining -= (maxAdditionalAllocation * orderInState.pricePerUnit);
          state.remainingStock -= maxAdditionalAllocation;
        }
      }
    },

    resetAllocations: (state) => {
      state.orders.forEach(order => {
        const customer = state.orders.find(o => o.customer.id === order.customer.id).customer;
        order.customer.creditRemaining = customer.creditLimit;
        order.allocatedQty = 0;
      });
      state.remainingStock = state.totalStock;
    }
  }
});

export const {
  setVersionKey,
  setLoading,
  loadMoreOrders,
  allocateToOrder,
  autoAllocate,
  resetAllocations
} = allocationSlice.actions;

export const store = configureStore({
  reducer: {
    allocation: allocationSlice.reducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['allocation/loadMoreOrders', 'allocation/autoAllocate'],
      },
    }),
});