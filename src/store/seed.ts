/**
 * Starter wardrobe seeded on first launch. Photoless (the UI renders a colored
 * placeholder) so the recommendation flow is demonstrable before the user adds
 * their own clothes. Spans categories, formality, and warmth.
 */
import type { ClothingItem } from '@/types';

const base = { source: 'manual' as const, createdAt: Date.now(), updatedAt: Date.now() };

export const SEED_ITEMS: ClothingItem[] = [
  // Tops
  { ...base, id: 'seed-white-tee', name: 'White crew tee', category: 'top', subtype: 't-shirt', colors: ['white'], formality: 2, warmth: 1, occasions: ['casual', 'leisure', 'date'] },
  { ...base, id: 'seed-oxford', name: 'Light blue oxford shirt', category: 'top', subtype: 'oxford shirt', colors: ['blue', 'white'], formality: 3, warmth: 2, occasions: ['work', 'casual', 'date'] },
  { ...base, id: 'seed-knit', name: 'Charcoal wool sweater', category: 'top', subtype: 'sweater', colors: ['charcoal'], formality: 3, warmth: 4, occasions: ['work', 'casual', 'date'] },
  { ...base, id: 'seed-dress-shirt', name: 'White dress shirt', category: 'top', subtype: 'dress shirt', colors: ['white'], formality: 5, warmth: 2, occasions: ['formal', 'work'] },
  { ...base, id: 'seed-tank', name: 'Black athletic tank', category: 'top', subtype: 'tank', colors: ['black'], formality: 1, warmth: 1, occasions: ['workout'] },

  // Bottoms
  { ...base, id: 'seed-jeans', name: 'Dark wash jeans', category: 'bottom', subtype: 'jeans', colors: ['denim', 'navy'], formality: 2, warmth: 3, occasions: ['casual', 'leisure', 'date'] },
  { ...base, id: 'seed-chinos', name: 'Khaki chinos', category: 'bottom', subtype: 'chinos', colors: ['khaki'], formality: 3, warmth: 3, occasions: ['work', 'casual', 'date'] },
  { ...base, id: 'seed-trousers', name: 'Charcoal wool trousers', category: 'bottom', subtype: 'trousers', colors: ['charcoal'], formality: 5, warmth: 3, occasions: ['formal', 'work'] },
  { ...base, id: 'seed-shorts', name: 'Running shorts', category: 'bottom', subtype: 'shorts', colors: ['black'], formality: 1, warmth: 1, occasions: ['workout', 'leisure'] },

  // Dress
  { ...base, id: 'seed-dress', name: 'Black midi dress', category: 'dress', subtype: 'midi dress', colors: ['black'], formality: 4, warmth: 2, occasions: ['date', 'formal', 'work'] },

  // Outerwear
  { ...base, id: 'seed-jacket', name: 'Navy bomber jacket', category: 'outerwear', subtype: 'bomber', colors: ['navy'], formality: 2, warmth: 3, occasions: ['casual', 'leisure', 'date'] },
  { ...base, id: 'seed-coat', name: 'Camel wool overcoat', category: 'outerwear', subtype: 'overcoat', colors: ['tan', 'camel'], formality: 4, warmth: 5, occasions: ['work', 'formal', 'date'] },
  { ...base, id: 'seed-rain', name: 'Olive rain shell', category: 'outerwear', subtype: 'rain jacket', colors: ['khaki'], formality: 2, warmth: 2, occasions: ['casual', 'leisure'] },

  // Footwear
  { ...base, id: 'seed-sneakers', name: 'White leather sneakers', category: 'footwear', subtype: 'sneakers', colors: ['white'], formality: 2, warmth: 2, occasions: ['casual', 'leisure', 'date', 'work'] },
  { ...base, id: 'seed-derbies', name: 'Brown leather derbies', category: 'footwear', subtype: 'derby shoes', colors: ['brown'], formality: 4, warmth: 2, occasions: ['work', 'formal', 'date'] },
  { ...base, id: 'seed-oxfords', name: 'Black oxford shoes', category: 'footwear', subtype: 'oxford shoes', colors: ['black'], formality: 5, warmth: 2, occasions: ['formal', 'work'] },
  { ...base, id: 'seed-runners', name: 'Running shoes', category: 'footwear', subtype: 'trainers', colors: ['grey'], formality: 1, warmth: 2, occasions: ['workout', 'leisure'] },

  // Accessories
  { ...base, id: 'seed-belt', name: 'Brown leather belt', category: 'accessory', subtype: 'belt', colors: ['brown'], formality: 3, warmth: 1, occasions: ['work', 'casual', 'formal', 'date'] },
  { ...base, id: 'seed-watch', name: 'Steel watch', category: 'accessory', subtype: 'watch', colors: ['grey'], formality: 3, warmth: 1, occasions: ['work', 'casual', 'formal', 'date', 'leisure'] },
  { ...base, id: 'seed-scarf', name: 'Grey wool scarf', category: 'accessory', subtype: 'scarf', colors: ['grey'], formality: 3, warmth: 4, occasions: ['casual', 'work', 'date'] },
];
