import { configureStore, createSlice } from '@reduxjs/toolkit';

// Mock data generator
const MOCK_CUSTOMERS = Array.from({ length: 20 }, (_, i) => {
  const customerId = `CUST-${String(i + 1).padStart(2, '0')}`;
  const name = `Balerion${String(i + 1).padStart(2, '0')}`;
  const creditLimit = parseFloat((Math.random() * 5000 + 1000).toFixed(2)); 
  return {
    id: customerId,
    name: name,
    creditLimit: creditLimit,
    creditRemaining: creditLimit 
  };
});

const generateMockOrder = (id) => {
  const randomCustomer = MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)];

  return {
    id: `ORDER-${String(id).padStart(3, '0')}`,
    status: Math.random() > 0.7 ? 'NEW' : Math.random() > 0.5 ? 'OVER_DUE' : 'EMERGENCY',
    priority: Math.random() > 0.8 ? 'HIGH' : 'NORMAL',
    customer: {
      id: randomCustomer.id,
      name: randomCustomer.name,
      creditRemaining: randomCustomer.creditLimit, 
      creditLimit: randomCustomer.creditLimit
    },
    product: {
      id: 'SALMON-001',
      name: 'Salmon',
      remark: '1 day delivery Product'
    },
    pricePerUnit: parseFloat((Math.random() * 200 + 400).toFixed(2)),
    requestedQty: Math.floor(Math.random() * 5) + 5,
    allocatedQty: 0,
    createdAt: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000
  };
};

const initialState = {
  versionKey: 'v1.0.0',
  totalStock: 200,
  remainingStock: 200,
  orders: [],
  isLoading: false,
  hasMoreData: true,
  currentPage: 0,
  pageSize: 10, 
  totalOrdersGenerated: 0,
  maxOrders: 70,
  // เพิ่ม error state
  error: null,
  lastAllocationError: null
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

    // เพิ่ม action สำหรับ clear error
    clearError: (state) => {
      state.error = null;
      state.lastAllocationError = null;
    },

    loadMoreOrders: (state, action) => {
      if (state.isLoading || !state.hasMoreData) return;

      state.isLoading = true;
      state.error = null; // clear error เมื่อเริ่มโหลด

      const ordersToGenerate = Math.min(state.pageSize, state.maxOrders - state.totalOrdersGenerated);

      if (ordersToGenerate <= 0) {
        state.hasMoreData = false;
        state.isLoading = false;
        return;
      }

      const startId = state.totalOrdersGenerated + 1;
      const newOrders = Array.from({ length: ordersToGenerate }, (_, i) =>
        generateMockOrder(startId + i)
      ).sort((a, b) => a.createdAt - b.createdAt);

      state.orders.push(...newOrders);
      state.totalOrdersGenerated += ordersToGenerate;
      state.currentPage += 1;
      state.isLoading = false;

      if (state.totalOrdersGenerated >= state.maxOrders) {
        state.hasMoreData = false;
      }
    },

    // แก้ไข allocateToOrder ให้ไม่ throw error แต่ return error message แทน
    allocateToOrder: (state, action) => {
      const { orderId, quantity } = action.payload;
      
      // Clear previous errors
      state.error = null;
      state.lastAllocationError = null;

      const order = state.orders.find(o => o.id === orderId);

      if (!order) {
        state.lastAllocationError = {
          orderId,
          message: 'Order not found.',
          type: 'ORDER_NOT_FOUND'
        };
        return;
      }

      const currentAllocation = order.allocatedQty;
      const requestedAllocation = Math.max(0, Math.min(quantity, order.requestedQty));

      // ตรวจสอบ stock
      const stockNeeded = requestedAllocation - currentAllocation;
      if (stockNeeded > state.remainingStock) {
        state.lastAllocationError = {
          orderId,
          message: `Not enough stock remaining. Available: ${state.remainingStock}, Required: ${stockNeeded}`,
          type: 'INSUFFICIENT_STOCK',
          availableStock: state.remainingStock,
          requiredStock: stockNeeded
        };
        return;
      }

      // ตรวจสอบ credit limit
      const currentCost = currentAllocation * order.pricePerUnit;
      const newCost = requestedAllocation * order.pricePerUnit;
      const costDifference = newCost - currentCost;

      if (costDifference > 0 && costDifference > order.customer.creditRemaining) {
        state.lastAllocationError = {
          orderId,
          message: `Exceeds customer credit limit. Available credit: ${order.customer.creditRemaining.toFixed(2)}, Required: ${costDifference.toFixed(2)}`,
          type: 'CREDIT_LIMIT_EXCEEDED',
          availableCredit: order.customer.creditRemaining,
          requiredCredit: costDifference,
          customerName: order.customer.name
        };
        return;
      }

      // ถ้าผ่านการตรวจสอบทั้งหมด ให้ทำการ allocate
      order.allocatedQty = requestedAllocation;
      state.remainingStock -= stockNeeded;
      order.customer.creditRemaining -= costDifference;
    },

    autoAllocate: (state) => {
      state.error = null;
      state.lastAllocationError = null;

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

      // First Pass
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

      // Second Pass
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
      state.error = null;
      state.lastAllocationError = null;
      
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
  clearError,
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