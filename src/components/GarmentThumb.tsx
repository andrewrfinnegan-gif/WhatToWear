/**
 * Square garment thumbnail. Shows the photo when present, otherwise a tidy
 * color-blocked placeholder derived from the item's colors so the closet still
 * reads clearly before photos are added.
 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import type { ClothingItem } from '@/types';
import { colors, radius } from '@/theme';
import { colorToHex, contrastText } from '@/utils/colorMap';

interface Props {
  item: ClothingItem;
  size?: number;
  rounded?: keyof typeof radius;
}

export function GarmentThumb({ item, size = 96, rounded = 'md' }: Props) {
  const dimension = { width: size, height: size, borderRadius: radius[rounded] };

  if (item.imageUri) {
    return (
      <Image
        source={{ uri: item.imageUri }}
        style={[dimension, styles.image]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  const primary = colorToHex(item.colors[0]);
  const secondary = item.colors[1] ? colorToHex(item.colors[1]) : primary;
  const initials = item.subtype?.slice(0, 1).toUpperCase() ?? item.name.slice(0, 1).toUpperCase();

  return (
    <View style={[dimension, styles.placeholder]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: primary }]} />
      <View style={[styles.diagonal, { backgroundColor: secondary }]} />
      <Text style={[styles.initial, { color: contrastText(primary) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: { backgroundColor: colors.surfaceAlt },
  placeholder: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  diagonal: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: '70%',
    height: '70%',
    transform: [{ rotate: '25deg' }],
    opacity: 0.55,
  },
  initial: { fontSize: 22, fontWeight: '800' },
});
