import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {View, Text,FlatList,SafeAreaView, RefreshControl} from 'react-native';
import { allocationScreenStyles as styles } from '../styles/sharedStyles';
import { useDispatch, useSelector } from 'react-redux';
import { Card, ProgressBar } from 'react-native-paper';
import { loadMoreOrders, allocateToOrder, autoAllocate, resetAllocations } from '../store/store';
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
    versionKey
  } = useSelector(state => state.allocation);

  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    dispatch(loadMoreOrders());
    const timer = setTimeout(() => dispatch(autoAllocate()), 1000);
    return () => clearTimeout(timer);
  }, [dispatch, versionKey]);

  const handleLoadMore = useCallback(() => {
    if (!isLoading && hasMoreData && remainingStock > 0) {
      dispatch(loadMoreOrders());
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

  const renderOrderCard = useCallback(({ item, index }) => (
    <OrderCard
      order={item}
      index={index}
      onAllocate={(quantity) =>
        dispatch(allocateToOrder({ orderId: item.id, quantity }))
      }
    />
  ), [dispatch]);

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Enhanced Header Card */}
      <Card style={styles.headerCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Allocation</Text>
            <View style={styles.headerRight}>
              <Text style={styles.headerTotal}>Total {totalStock} Units</Text>
            </View>
          </View>

          {/* Stock Information */}
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
    </SafeAreaView>
  );
};


export default AllocationScreen;