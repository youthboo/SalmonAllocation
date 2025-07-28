import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {View, Text, FlatList, SafeAreaView, RefreshControl, Alert} from 'react-native';
import { allocationScreenStyles as styles } from '../styles/sharedStyles';
import { useDispatch, useSelector } from 'react-redux';
import { Card, ProgressBar, Snackbar } from 'react-native-paper';
import { loadMoreOrders, allocateToOrder, autoAllocate, resetAllocations, clearError } from '../store/store';
import OrderCard from '../components/OrderCard';

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

const AllocationScreen = () => {
  const dispatch = useDispatch();
  const {
    orders,
    remainingStock,
    totalStock,
    isLoading,
    hasMoreData,
    versionKey,
    lastAllocationError
  } = useSelector(state => state.allocation);

  const [refreshing, setRefreshing] = useState(false);
  const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);

  const totalAllocated = useMemo(() =>
    orders.reduce((sum, order) => sum + order.allocatedQty, 0),
    [orders]
  );

  const displayOrders = useMemo(() => {
    return [...orders].sort((a, b) => {
      const priorityDiff = getPriorityScore(b) - getPriorityScore(a);
      if (priorityDiff !== 0) return priorityDiff;
      return a.createdAt - b.createdAt;
    });
  }, [orders]);

  // Handle allocation errors
  useEffect(() => {
    if (lastAllocationError) {
      setShowErrorSnackbar(true);
      
      if (lastAllocationError.type === 'CREDIT_LIMIT_EXCEEDED') {
        Alert.alert(
          'Credit Limit Exceeded',
          `Customer ${lastAllocationError.customerName} has insufficient credit.\n\nAvailable: ${lastAllocationError.availableCredit.toFixed(2)}\nRequired: ${lastAllocationError.requiredCredit.toFixed(2)}`,
          [
            {
              text: 'OK',
              onPress: () => dispatch(clearError())
            }
          ]
        );
      } else if (lastAllocationError.type === 'INSUFFICIENT_STOCK') {
        Alert.alert(
          'Insufficient Stock',
          `Not enough stock available.\nAvailable: ${lastAllocationError.availableStock} units`,
          [
            {
              text: 'OK', 
              onPress: () => dispatch(clearError())
            }
          ]
        );
      }
    }
  }, [lastAllocationError, dispatch]);

  useEffect(() => {
    dispatch(loadMoreOrders());
    const timer = setTimeout(() => dispatch(autoAllocate()), 1000);
    return () => clearTimeout(timer);
  }, [dispatch, versionKey]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMoreData && remainingStock > 0) {
      dispatch(loadMoreOrders());
      setTimeout(() => {
        dispatch(autoAllocate());
      }, 100); 
    }
  }, [dispatch, isLoading, hasMoreData, remainingStock]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    dispatch(resetAllocations());
    setTimeout(() => {
      dispatch(autoAllocate());
      setRefreshing(false);
    }, 1000);
  }, [dispatch]);

  const handleAllocate = useCallback((orderId, quantity) => {
    // Clear previous errors
    dispatch(clearError());
    
    // Perform allocation
    dispatch(allocateToOrder({ orderId, quantity }));
  }, [dispatch]);

  const renderOrderCard = useCallback(({ item, index }) => (
    <OrderCard
      order={item}
      index={index}
      onAllocate={(quantity) => handleAllocate(item.id, quantity)}
    />
  ), [handleAllocate]);

  const renderFooter = useCallback(() => {
    if (!isLoading) return null;
    return (
      <View style={styles.footer}>
        <Text style={styles.footerText}>Loading more orders...</Text>
        <ProgressBar indeterminate color="#2196F3" style={styles.progressBar} />
      </View>
    );
  }, [isLoading]);

  const keyExtractor = useCallback((item) => item.id, []);

  const handleDismissSnackbar = useCallback(() => {
    setShowErrorSnackbar(false);
    dispatch(clearError());
  }, [dispatch]);

  return (
    <SafeAreaView style={styles.container}>
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Allocation</Text>
            <View style={styles.headerRight}>
              <Text style={styles.headerTotal}>Total {totalStock} Units</Text>
            </View>
          </View>

          <View style={styles.stockInfo}>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Remaining</Text>
              <Text style={[styles.stockValue, { color: remainingStock > 0 ? '#4CAF50' : '#F44336' }]}>
                {remainingStock} Units
              </Text>
            </View>
            <View style={styles.stockItem}>
              <Text style={styles.stockLabel}>Allocated</Text>
              <Text style={[styles.stockValue, { color: '#2196F3' }]}>
                {totalAllocated} Units
              </Text>
            </View>
          </View>

        </Card.Content>
      </Card>

      <FlatList
        data={displayOrders}
        keyExtractor={keyExtractor}
        renderItem={renderOrderCard}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        style={styles.list}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        initialNumToRender={10}
        windowSize={10}
      />

      {remainingStock === 0 && (
        <View style={styles.statusBar}>
          <Text style={styles.statusText}>
            All stock has been allocated!
          </Text>
        </View>
      )}

      {/* Error Snackbar for less critical errors */}
      <Snackbar
        visible={showErrorSnackbar && lastAllocationError && lastAllocationError.type === 'ORDER_NOT_FOUND'}
        onDismiss={handleDismissSnackbar}
        duration={4000}
        style={{ backgroundColor: '#F44336' }}
      >
        {lastAllocationError?.message}
      </Snackbar>
    </SafeAreaView>
  );
};

export default AllocationScreen;