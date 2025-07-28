// src/components/OrderCard.js 
import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { Card, Chip, TextInput, Button, IconButton } from 'react-native-paper';
import { orderCardStyles as styles } from '../styles/sharedStyles';

const OrderCard = ({ order, onAllocate, disabled = false }) => { 
  const [allocationInput, setAllocationInput] = useState(order.allocatedQty.toString());
  const [isEditing, setIsEditing] = useState(false);

  const handleAllocate = () => {
    const quantity = parseInt(allocationInput) || 0;
    if (quantity < 0) {
      Alert.alert('Error', 'Allocation cannot be negative');
      return;
    }
    if (quantity > order.requestedQty) {
      Alert.alert('Error', 'Cannot allocate more than requested quantity');
      return;
    }
    onAllocate(quantity);
    setIsEditing(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'NEW': return '#000000';
      case 'EMERGENCY': return '#FF2424'; 
      case 'OVER_DUE': return '#FFB647'; 
    }
  };

  return (
    <Card style={[
      styles.card, 
      disabled && styles.disabledCard 
    ]}>
      <Card.Content>
        <View style={styles.orderHeader}>
          <Text style={styles.orderId}>{order.id}</Text>
          <View style={styles.statusContainer}>
           <Chip 
              mode="flat"
              textStyle={{ color: 'white' }}
              style={{ backgroundColor: getStatusColor(order.status),  borderRadius: 20, paddingHorizontal: 2, height: 30, }}
            >
              {order.status}
            </Chip>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Customer</Text>
          <Text style={styles.value}>{order.customer.name}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Credit Remaining</Text>
          <Text style={styles.value}>
            {order.customer.creditRemaining.toFixed(2)} THB
          </Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Closing</Text>
          <Text style={styles.value}>
            {order.customer.creditLimit.toFixed(2)} THB
          </Text>
        </View>

        {/* Product Info */}
        <View style={styles.row}>
          <Text style={styles.label}>Product</Text>
          <Text style={styles.value}>{order.product.name}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Remark</Text>
          <Text style={styles.value}>{order.product.remark}</Text>
        </View>

        {/* Price and Quantity */}
        <View style={styles.row}>
          <Text style={styles.label}>Price Per Unit</Text>
          <Text style={styles.value}>{order.pricePerUnit.toFixed(2)} THB</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Request Qty</Text>
          <Text style={styles.value}>{order.requestedQty} Unit</Text>
        </View>

        {/* Allocation Section */}
        <View style={styles.allocationSection}>
          <Text style={styles.label}>Allocated Qty</Text>
          <View style={styles.allocationControls}>
            {isEditing ? (
              <View style={styles.editingControls}>
                <TextInput
                  value={allocationInput}
                  onChangeText={setAllocationInput}
                  keyboardType="numeric"
                  style={styles.input}
                  dense
                  disabled={disabled} 
                />
                <Button 
                  mode="contained" 
                  onPress={handleAllocate} 
                  compact
                  disabled={disabled}
                >
                  Save
                </Button>
                <Button 
                  mode="outlined" 
                  onPress={() => {
                    setIsEditing(false);
                    setAllocationInput(order.allocatedQty.toString());
                  }}
                  compact
                >
                  Cancel
                </Button>
              </View>
            ) : (
              <View style={styles.displayControls}>
                <Text style={styles.allocationValue}>
                  {order.allocatedQty} Unit
                </Text>
                {!disabled && (
                  <IconButton
                    icon="pencil"
                    size={20}
                    onPress={() => setIsEditing(true)}
                  />
                )}
                {disabled && (
                  <Text style={styles.disabledText}>Auto Mode</Text>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Total Cost */}
        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>Total Cost</Text>
          <Text style={styles.totalValue}>
            {(order.allocatedQty * order.pricePerUnit).toFixed(2)} THB
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};

export default OrderCard;