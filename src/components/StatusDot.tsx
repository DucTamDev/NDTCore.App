// src/components/StatusDot.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';

export interface StatusDotProps {
  color: string;
}

export const StatusDot: React.FC<StatusDotProps> = ({ color }) => (
  <View style={[styles.dot, { backgroundColor: color }]} />
);

const styles = StyleSheet.create({
  dot: { width: 8, height: 8, borderRadius: 4 },
});
