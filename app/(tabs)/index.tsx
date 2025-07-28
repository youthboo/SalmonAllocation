import 'react-native-gesture-handler';
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import { PaperProvider } from 'react-native-paper';
import { store } from '../../store/store';
import AllocationScreen from '../../screens/AllocationScreen';

const Stack = createStackNavigator();
export default function App() {
  return (
    <Provider store={store}>
      <PaperProvider>
          <Stack.Navigator>
            <Stack.Screen 
              name="Allocation" 
              component={AllocationScreen}
              options={{ title: 'Salmon Allocation' }}
            />
          </Stack.Navigator>
      </PaperProvider>
    </Provider>
  );
}
